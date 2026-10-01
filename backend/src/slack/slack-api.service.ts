import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { WebClient } from '@slack/web-api';
import type { Queue } from 'bullmq';
import { DbService } from '@src/db/db.service';
import { EncryptionService } from '@src/infrastructure/encryption.service';
import type { SlackApiJob } from '@src/common/types';

@Injectable()
export class SlackApiService {
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
    const installation = await this.db.slackInstallation.findFirst({
      where: { teamId, isActive: true },
    });

    if (!installation) {
      throw new Error(`No active Slack installation for team ${teamId}`);
    }

    const botToken = this.encryption.decrypt(installation.botToken);
    const client = new WebClient(botToken);
    return client.apiCall(method, args);
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
}
