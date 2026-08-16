import {
  Controller,
  Get,
  Delete,
  Query,
  Req,
  Res,
  UseGuards,
  Inject,
} from '@nestjs/common';
import type { Response } from 'express';
import { createHash, randomUUID } from 'crypto';
import { WebClient } from '@slack/web-api';
import type { RedisClientType } from 'redis';
import { JwtAuthGuard } from '@src/auth/jwt-auth.guard';
import { SlackInstallationStore } from './slack-installation.store';
import { SlackApiService } from './slack-api.service';
import { ActivityService } from '@src/activity/activity.service';
import { REDIS_CLIENT } from '@src/common/cache';
import { Secrets } from '@src/common/secrets';
import { ActivityType } from '@generated/client';
import type { Prisma } from '@generated/client';
import type { AuthenticatedRequest } from '@src/common/types';
import { Logger } from '@src/common/logger';

@Controller('slack')
export class SlackInstallController {
  private readonly STATE_TTL_SECONDS = 600;
  private readonly logger = Logger(SlackInstallController.name);

  constructor(
    private readonly installationStore: SlackInstallationStore,
    private readonly slackApi: SlackApiService,
    private readonly activity: ActivityService,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClientType,
  ) {}

  @Get('install')
  @UseGuards(JwtAuthGuard)
  async install(@Req() req: AuthenticatedRequest) {
    const state = randomUUID();
    const stateKey = this.getStateKey(state);

    await this.redis.set(stateKey, req.user.id, {
      expiration: { type: 'EX', value: this.STATE_TTL_SECONDS },
    });

    const url = new URL('https://slack.com/oauth/v2/authorize');
    url.searchParams.set('client_id', Secrets.SLACK_CLIENT_ID);
    url.searchParams.set('scope', Secrets.SLACK_BOT_SCOPES);
    url.searchParams.set('redirect_uri', Secrets.SLACK_REDIRECT_URI);
    url.searchParams.set('state', state);

    return { url: url.toString() };
  }

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const failureUrl = `${Secrets.FRONTEND_URL}/settings?slack_install=error`;

    if (error) {
      this.logger.warn(`Slack OAuth error: ${error}`);
      res.redirect(failureUrl);
      return;
    }

    if (!code || !state) {
      this.logger.warn('Missing code or state in callback');
      res.redirect(failureUrl);
      return;
    }

    const stateKey = this.getStateKey(state);
    const userId = await this.redis.get(stateKey);

    if (!userId) {
      this.logger.warn('State not found or expired');
      res.redirect(failureUrl);
      return;
    }

    await this.redis.del(stateKey);

    try {
      const client = new WebClient();
      const oauth = await client.oauth.v2.access({
        client_id: Secrets.SLACK_CLIENT_ID,
        client_secret: Secrets.SLACK_CLIENT_SECRET,
        code,
        redirect_uri: Secrets.SLACK_REDIRECT_URI,
      });

      if (!oauth.ok) {
        this.logger.error(`OAuth failed: ${oauth.error}`);
        res.redirect(failureUrl);
        return;
      }

      const teamId = oauth.team?.id;
      const botToken = oauth.access_token;
      const botUserId = oauth.bot_user_id;
      const installerSlackUserId = oauth.authed_user?.id;

      if (!teamId || !botToken || !botUserId || !installerSlackUserId) {
        this.logger.error('Missing required Slack OAuth fields');
        res.redirect(failureUrl);
        return;
      }

      await this.installationStore.storeInstallationData({
        userId,
        teamId,
        teamName: oauth.team?.name ?? null,
        enterpriseId: oauth.enterprise?.id ?? null,
        botToken,
        botUserId,
        botId: botUserId,
        appId: oauth.app_id ?? null,
        scopes: oauth.scope?.split(',') ?? [],
        installerSlackUserId,
        isEnterpriseInstall: oauth.is_enterprise_install ?? false,
        raw: oauth as unknown as Prisma.InputJsonValue,
      });

      await this.activity.log(ActivityType.slack_installation_added, userId, {
        teamId: oauth.team?.id,
        enterpriseId: oauth.enterprise?.id,
      });
      res.redirect(`${Secrets.FRONTEND_URL}/settings?slack_install=connected`);
    } catch (err) {
      this.logger.error(
        `Slack OAuth callback failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      res.redirect(failureUrl);
    }
  }

  @Delete('installation')
  @UseGuards(JwtAuthGuard)
  async disconnect(@Req() req: AuthenticatedRequest) {
    await this.slackApi.disconnect(req.user.id);
    await this.activity.log(
      ActivityType.slack_installation_removed,
      req.user.id,
    );
  }

  private getStateKey(state: string): string {
    return `slack:oauth:state:${createHash('sha256').update(state).digest('hex')}`;
  }
}
