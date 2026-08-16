import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import jwt from 'jsonwebtoken';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { Secrets } from '@src/common/secrets';
import { DbService } from '@src/db/db.service';
import { ActivityService } from '@src/activity/activity.service';
import { CleanupService } from '@src/cleanup/cleanup.service';
import {
  ActivityType,
  BuildStatus,
  DeploymentTrigger,
  LifecycleStatus,
} from '@generated/client';
import {
  GitHubAccountResponse,
  GitHubRepositoryList,
  DeploymentJob,
} from '@src/common/types';
import type { RedisClientType } from 'redis';
import { REDIS_CLIENT } from '@src/common/cache';
import { Logger } from '@src/common/logger';

@Injectable()
export class GitHubService {
  private readonly STATE_TTL_SECONDS = 600;
  private readonly logger = Logger(GitHubService.name);

  constructor(
    private readonly db: DbService,
    private readonly activity: ActivityService,
    private readonly cleanup: CleanupService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClientType,
    @InjectQueue('deployments')
    private readonly deployQueue: Queue<DeploymentJob>,
  ) {}

  async getInstallUrl(userId: string) {
    const state = randomUUID();
    await this.redis.set(this.getStateKey(state), userId, {
      expiration: { type: 'EX', value: this.STATE_TTL_SECONDS },
    });

    return `https://github.com/apps/${Secrets.GITHUB_APP_SLUG}/installations/new?state=${state}`;
  }

  async getUpdateAccessUrl(
    installationId: number,
    userId: string,
  ): Promise<string> {
    await this.verifyOwnership(installationId, userId);

    await this.cache.del(
      `/api/github/installations/${installationId}/repositories`,
    );

    const sources = await this.db.source.findMany({
      where: { installationId },
      select: { repositoryUrl: true },
    });

    for (const { repositoryUrl } of sources) {
      const repoFullName = repositoryUrl.replace('https://github.com/', '');
      await this.cache.del(
        `/api/github/installations/${installationId}/branches?repo=${repoFullName}`,
      );
    }

    return `https://github.com/settings/installations/${installationId}`;
  }

  async handleInstallCallback(installationId: number, state?: string) {
    const failureUrl = `${Secrets.FRONTEND_URL}/settings?github_install=error`;

    if (!state) {
      this.logger.warn('Missing state in GitHub install callback');
      return failureUrl;
    }

    const stateKey = this.getStateKey(state);
    const userId = await this.redis.get(stateKey);

    if (!userId) {
      this.logger.warn('State not found or expired');
      return failureUrl;
    }

    await this.redis.del(stateKey);

    const existing = await this.db.gitHubInstallation.findFirst({
      where: { installationId },
    });
    if (existing) {
      return `${Secrets.FRONTEND_URL}/settings?github_install=connected`;
    }

    const token = this.generateAppJwt();
    const response = await fetch(
      `https://api.github.com/app/installations/${installationId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      },
    );

    if (!response.ok) {
      throw new NotFoundException(
        `Failed to fetch installation details: ${response.statusText}`,
      );
    }

    const data = (await response.json()) as GitHubAccountResponse;

    await this.db.gitHubInstallation.create({
      data: {
        installationId,
        accountLogin: data.account.login,
        accountType: data.account.type,
        userId,
      },
    });

    await this.activity.log(ActivityType.github_installation_added, userId, {
      installationId,
      accountLogin: data.account.login,
    });

    return `${Secrets.FRONTEND_URL}/settings?github_install=connected`;
  }

  async listInstallations(userId: string) {
    return this.db.gitHubInstallation.findMany({
      where: { userId },
    });
  }

  async getInstallationToken(installationId: number): Promise<string> {
    const token = this.generateAppJwt();
    const response = await fetch(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to get installation token: ${response.statusText}`,
      );
    }

    const data = (await response.json()) as { token: string };
    return data.token;
  }

  async deleteInstallation(installationId: number, userId: string) {
    await this.verifyOwnership(installationId, userId);

    const token = this.generateAppJwt();
    const response = await fetch(
      `https://api.github.com/app/installations/${installationId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      },
    );

    if (!response.ok) {
      throw new NotFoundException(
        `Failed to remove installation: ${response.statusText}`,
      );
    }

    const sources = await this.db.source.findMany({
      where: { installationId },
      select: { projectId: true },
    });

    await this.db.gitHubInstallation.deleteMany({
      where: { installationId },
    });

    for (const { projectId } of sources) {
      await this.cleanup.enqueueProjectCleanup(projectId, userId);
    }

    await this.activity.log(ActivityType.github_installation_removed, userId, {
      installationId,
    });
  }

  async listRepositories(installationId: number, userId: string) {
    await this.verifyOwnership(installationId, userId);

    const token = await this.getInstallationToken(installationId);
    const response = await fetch(
      'https://api.github.com/installation/repositories?per_page=100',
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      },
    );

    if (!response.ok) {
      throw new NotFoundException(
        `Failed to list repositories: ${response.statusText}`,
      );
    }

    const data = (await response.json()) as GitHubRepositoryList;
    return data.repositories.reverse();
  }

  async listBranches(
    installationId: number,
    repositoryUrl: string,
    userId: string,
  ) {
    await this.verifyOwnership(installationId, userId);

    const token = await this.getInstallationToken(installationId);

    const url = new URL(repositoryUrl);
    const [, owner, repo] = url.pathname.split('/');

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/branches`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      },
    );

    if (!response.ok) {
      throw new NotFoundException(
        `Failed to list branches: ${response.statusText}`,
      );
    }

    const data = (await response.json()) as { name: string }[];
    return data;
  }

  verifySignature(payload: Buffer, signature: string): boolean {
    if (!signature) return false;

    const hmac = createHmac('sha256', Secrets.GITHUB_WEBHOOK_SECRET);
    const digest = `sha256=${hmac.update(payload).digest('hex')}`;

    try {
      return timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  async handlePushEvent(branchRef: string, repoFullName: string) {
    const branch = branchRef.replace('refs/heads/', '');

    const source = await this.db.source.findFirst({
      where: {
        repositoryUrl: { equals: `https://github.com/${repoFullName}` },
      },
      include: { project: { include: { environments: true } } },
    });

    if (!source) return;

    for (const env of source.project.environments) {
      if (env.branch !== branch || !env.autoDeploy) {
        continue;
      }

      const deployment = await this.db.deployment.create({
        data: {
          environmentId: env.id,
          trigger: DeploymentTrigger.webhook,
          imageTag: null,
          commitSha: '',
          buildStatus: BuildStatus.pending,
          lifecycleStatus: LifecycleStatus.inactive,
        },
      });

      await this.activity.log(
        ActivityType.deployment_started,
        source.project.ownerId,
        {
          deploymentId: deployment.id,
          environmentId: env.id,
          trigger: deployment.trigger,
        },
      );

      await this.deployQueue.add('webhook', { deployment });
    }
  }

  private getStateKey(state: string): string {
    return `github:install:state:${createHash('sha256').update(state).digest('hex')}`;
  }

  private generateAppJwt(): string {
    return jwt.sign({}, Secrets.GITHUB_APP_PRIVATE_KEY, {
      algorithm: 'RS256',
      issuer: Secrets.GITHUB_APP_ID,
      expiresIn: 600,
    });
  }

  private async verifyOwnership(installationId: number, userId: string) {
    const installation = await this.db.gitHubInstallation.findFirst({
      where: { installationId, userId },
    });

    if (!installation) {
      throw new NotFoundException('Installation not found');
    }

    return installation;
  }
}
