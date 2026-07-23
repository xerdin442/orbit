import {
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Request } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Queue } from 'bull';
import { DbService } from '@src/db/db.service';
import { Secrets } from '@src/common/secrets';
import { Logger } from '@src/common/logger';
import {
  BuildStatus,
  DeploymentTrigger,
  LifecycleStatus,
} from '@generated/client';
import { GitHubWebhookPayload } from '@src/common/types';

@Controller('github')
export class GitHubWebhookController {
  private readonly logger = Logger(GitHubWebhookController.name);

  constructor(
    private readonly db: DbService,
    @InjectQueue('deployments') private readonly deployQueue: Queue,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature: string,
    @Headers('x-github-event') event: string,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) {
      return { ok: false };
    }

    if (!this.verifySignature(rawBody, signature)) {
      this.logger.warn('Invalid webhook signature');
      return { ok: false };
    }

    const payload = JSON.parse(rawBody.toString()) as GitHubWebhookPayload;

    this.logger.info(
      `Webhook event: ${event} on ${payload.repository?.full_name}. Installation id: ${payload.installation?.id}.`,
    );

    if (event === 'installation' || event === 'installation_repositories') {
      if (payload.action === 'deleted' || payload.action === 'removed') {
        await this.handleInstallationRemoved(payload.installation?.id);
      }
      return { ok: true };
    }

    if (event === 'push' && payload.ref && payload.repository) {
      await this.handlePushEvent(payload.ref, payload.repository.full_name);
    }

    return { ok: true };
  }

  private verifySignature(payload: Buffer, signature: string): boolean {
    if (!signature) {
      return false;
    }

    const hmac = createHmac('sha256', Secrets.GITHUB_WEBHOOK_SECRET);
    const digest = `sha256=${hmac.update(payload).digest('hex')}`;

    try {
      return timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  private async handlePushEvent(branchRef: string, repoFullName: string) {
    const branch = branchRef.replace('refs/heads/', '');

    const source = await this.db.source.findFirst({
      where: { repositoryUrl: { endsWith: repoFullName } },
      include: { project: { include: { environments: true } } },
    });

    if (!source) {
      return;
    }

    for (const env of source.project.environments) {
      if (env.branch !== branch || !env.autoDeploy) {
        continue;
      }

      const deployment = await this.db.deployment.create({
        data: {
          environmentId: env.id,
          trigger: DeploymentTrigger.webhook,
          imageTag: '',
          commitSha: '',
          buildStatus: BuildStatus.pending,
          lifecycleStatus: LifecycleStatus.inactive,
        },
      });

      await this.deployQueue.add({ deploymentId: deployment.id });
    }
  }

  private async handleInstallationRemoved(installationId?: number) {
    if (!installationId) {
      return;
    }

    await this.db.source.updateMany({
      where: { installationId },
      data: { installationId: null },
    });

    await this.db.gitHubInstallation.deleteMany({
      where: { installationId },
    });
  }
}
