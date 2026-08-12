import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { WebClient } from '@slack/web-api';
import type { Queue } from 'bullmq';
import { DbService } from '@src/db/db.service';
import { EncryptionService } from '@src/infrastructure/encryption.service';
import { Secrets } from '@src/common/secrets';
import type { SlackApiJob } from '@src/common/types';

@Injectable()
export class SlackApiService {
  private readonly clients = new Map<string, WebClient>();

  constructor(
    private readonly db: DbService,
    private readonly encryption: EncryptionService,
    @InjectQueue('slack-api') private readonly queue: Queue<SlackApiJob>,
  ) {}

  async call(
    teamId: string,
    method: string,
    args: Record<string, unknown> = {},
  ) {
    const client = await this.resolveClient(teamId);
    return client.apiCall(method, args);
  }

  invalidateClient(teamId: string): void {
    this.clients.delete(teamId);
  }

  async disconnect(userId: string): Promise<void> {
    const installation = await this.db.slackInstallation.findFirst({
      where: { userId, isActive: true },
    });

    if (!installation) {
      throw new NotFoundException('No active Slack installation found');
    }

    const result = await this.call(installation.teamId, 'apps.uninstall', {
      client_id: Secrets.SLACK_CLIENT_ID,
      client_secret: Secrets.SLACK_CLIENT_SECRET,
    });

    if (!result.ok) {
      const error = (result as { error?: string }).error;
      throw new Error(`Failed to uninstall Slack app: ${error}`);
    }

    await this.db.slackInstallation.update({
      where: { id: installation.id },
      data: { isActive: false },
    });

    this.invalidateClient(installation.teamId);
  }

  async enqueue(
    teamId: string,
    method: string,
    args: Record<string, unknown> = {},
  ): Promise<void> {
    await this.queue.add(
      method,
      { teamId, method, args },
      {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    );
  }

  private async resolveClient(teamId: string): Promise<WebClient> {
    const cached = this.clients.get(teamId);
    if (cached) return cached;

    const installation = await this.db.slackInstallation.findFirst({
      where: { teamId, isActive: true },
    });

    if (!installation) {
      throw new Error(`No active Slack installation for team ${teamId}`);
    }

    const botToken = this.encryption.decrypt(installation.botToken);
    const client = new WebClient(botToken);
    this.clients.set(teamId, client);
    return client;
  }
}
