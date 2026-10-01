import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  Inject,
  Logger,
  Redirect,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Installation } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import type { RedisClientType } from 'redis';
import { JwtAuthGuard } from '@src/auth/jwt-auth.guard';
import { SlackInstallationStore } from './slack-installation.store';
import { ActivityService } from '@src/activity/activity.service';
import { REDIS_CLIENT } from '@src/common/cache';
import { Secrets } from '@src/common/secrets';
import { ActivityType } from '@generated/client';
import type { AuthenticatedRequest } from '@src/common/types';

const STATE_TTL_SECONDS = 600;
const STATE_PREFIX = 'slack:oauth:state:';

@Controller('slack')
export class SlackInstallController {
  private readonly logger = new Logger(SlackInstallController.name);

  constructor(
    private readonly installationStore: SlackInstallationStore,
    private readonly activity: ActivityService,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClientType,
  ) {}

  @Redirect()
  @Get('install')
  @UseGuards(JwtAuthGuard)
  async install(@Req() req: AuthenticatedRequest) {
    const state = randomUUID();
    const stateKey = `${STATE_PREFIX}${state}`;

    await this.redis.set(stateKey, req.user.id, {
      expiration: { type: 'EX', value: STATE_TTL_SECONDS },
    });

    const url = new URL('https://slack.com/oauth/v2/authorize');
    url.searchParams.set('client_id', Secrets.SLACK_CLIENT_ID);
    url.searchParams.set('scope', Secrets.SLACK_BOT_SCOPES);
    url.searchParams.set('redirect_uri', Secrets.SLACK_REDIRECT_URI);
    url.searchParams.set('state', state);

    return { url: url.toString() };
  }

  @Redirect()
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
  ) {
    const failureUrl = `${Secrets.FRONTEND_URL}/settings?slack_install=error`;

    if (error) {
      this.logger.warn(`Slack OAuth error: ${error}`);
      return { url: failureUrl };
    }

    if (!code || !state) {
      this.logger.warn('Missing code or state in callback');
      return { url: failureUrl };
    }

    const stateKey = `${STATE_PREFIX}${state}`;
    const userId = await this.redis.get(stateKey);

    if (!userId) {
      this.logger.warn('State not found or expired');
      return { url: failureUrl };
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
        throw new Error(`OAuth failed: ${oauth.error}`);
      }

      const installation: Record<string, unknown> = {
        team: oauth.team,
        enterprise: oauth.enterprise ?? undefined,
        user: {
          token: oauth.authed_user?.access_token,
          refreshToken: oauth.authed_user?.refresh_token,
          expiresAt: oauth.authed_user?.expires_in
            ? Date.now() + oauth.authed_user.expires_in * 1000
            : undefined,
          scopes: oauth.authed_user?.scope?.split(','),
          id: oauth.authed_user?.id ?? '',
        },
        bot: oauth.bot_user_id
          ? {
              token: oauth.access_token!,
              refreshToken: oauth.refresh_token,
              expiresAt: oauth.expires_in
                ? Date.now() + oauth.expires_in * 1000
                : undefined,
              scopes: oauth.scope?.split(',') ?? [],
              id: oauth.bot_user_id,
              userId: oauth.bot_user_id,
            }
          : undefined,
        appId: oauth.app_id,
        tokenType: 'bot' as const,
        isEnterpriseInstall: oauth.is_enterprise_install ?? false,
        authVersion: 'v2' as const,
        metadata: userId,
        incomingWebhook: oauth.incoming_webhook,
      };

      await this.installationStore.storeInstallation(
        installation as unknown as Installation,
      );

      await this.activity.log(ActivityType.slack_installation_added, userId, {
        teamId: oauth.team?.id,
        enterpriseId: oauth.enterprise?.id,
      });

      return {
        url: `${Secrets.FRONTEND_URL}/settings?slack_install=connected`,
      };
    } catch (err) {
      this.logger.error(
        `Slack OAuth callback failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { url: failureUrl };
    }
  }
}
