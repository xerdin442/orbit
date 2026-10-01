import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  Req,
  Redirect,
  Inject,
  ParseIntPipe,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import type { RedisClientType } from 'redis';
import { GitHubService } from './github.service';
import { Secrets } from '@src/common/secrets';
import { REDIS_CLIENT } from '@src/common/cache';
import { JwtAuthGuard } from '@src/auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '@src/common/types';
import { Logger } from '@src/common/logger';

@Controller('github')
export class GitHubController {
  private readonly STATE_TTL_SECONDS = 600;
  private readonly logger = Logger(GitHubController.name);

  constructor(
    private readonly github: GitHubService,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClientType,
  ) {}

  @Get('install')
  @UseGuards(JwtAuthGuard)
  async install(@Req() req: AuthenticatedRequest) {
    const state = randomUUID();
    await this.redis.set(this.getStateKey(state), req.user.id, {
      expiration: { type: 'EX', value: this.STATE_TTL_SECONDS },
    });

    return {
      url: `https://github.com/apps/${Secrets.GITHUB_APP_ID}/installations/new?state=${state}`,
    };
  }

  @Get('install/callback')
  @Redirect()
  async installCallback(
    @Query('installation_id', ParseIntPipe) installationId: number,
    @Query('state') state?: string,
  ) {
    const failureUrl = `${Secrets.FRONTEND_URL}?github_install=error`;

    if (!state) {
      this.logger.warn('Missing state in GitHub install callback');
      return { url: failureUrl };
    }

    const stateKey = this.getStateKey(state);
    const userId = await this.redis.get(stateKey);

    if (!userId) {
      this.logger.warn('State not found or expired');
      return { url: failureUrl };
    }

    await this.redis.del(stateKey);

    await this.github.handleInstallCallback(installationId, userId);
    return { url: Secrets.FRONTEND_URL };
  }

  @Get('installations')
  @UseGuards(JwtAuthGuard)
  listInstallations(@Req() req: AuthenticatedRequest) {
    return this.github.listInstallations(req.user.id);
  }

  @Delete('installations/:installationId')
  @UseGuards(JwtAuthGuard)
  removeInstallation(
    @Req() req: AuthenticatedRequest,
    @Param('installationId', ParseIntPipe) installationId: number,
  ) {
    return this.github.deleteInstallation(installationId, req.user.id);
  }

  @Get('installations/:installationId/repositories')
  @UseGuards(JwtAuthGuard)
  listRepositories(
    @Req() req: AuthenticatedRequest,
    @Param('installationId', ParseIntPipe) installationId: number,
  ) {
    return this.github.listRepositories(installationId, req.user.id);
  }

  @Get('installations/:installationId/update-access')
  @UseGuards(JwtAuthGuard)
  async updateAccess(
    @Req() req: AuthenticatedRequest,
    @Param('installationId', ParseIntPipe) installationId: number,
  ) {
    const url = await this.github.getUpdateAccessUrl(
      installationId,
      req.user.id,
    );
    return { url };
  }

  @Get('installations/:installationId/branches')
  @UseGuards(JwtAuthGuard)
  listBranches(
    @Req() req: AuthenticatedRequest,
    @Param('installationId', ParseIntPipe) installationId: number,
    @Query('repo') repoFullName: string,
  ) {
    const url = `https://github.com/${repoFullName}`;
    return this.github.listBranches(installationId, url, req.user.id);
  }

  private getStateKey(state: string): string {
    return `github:install:state:${createHash('sha256').update(state).digest('hex')}`;
  }
}
