import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Worker } from 'bullmq';
import { WebClient } from '@slack/web-api';
import { Logger } from '@src/common/logger';
import { DbService } from '@src/db/db.service';
import { EncryptionService } from '@src/infrastructure/encryption.service';
import type { SlackApiJob } from '@src/common/types';

@Processor('slack-api')
export class SlackApiProcessor extends WorkerHost {
  private readonly logger = Logger(SlackApiProcessor.name);

  constructor(
    private readonly db: DbService,
    private readonly encryption: EncryptionService,
  ) {
    super();
  }

  async process(job: Job<SlackApiJob>): Promise<void> {
    const { teamId, method, args } = job.data;

    const installation = await this.db.slackInstallation.findFirst({
      where: { teamId, isActive: true },
    });

    if (!installation) {
      this.logger.warn(
        `Dropping slack job for inactive/missing team ${teamId}`,
      );
      return;
    }

    const botToken = this.encryption.decrypt(installation.botToken);
    const client = new WebClient(botToken);

    try {
      const fn = (
        client as unknown as Record<
          string,
          (args: Record<string, unknown>) => Promise<unknown>
        >
      )[method];

      if (typeof fn !== 'function') {
        this.logger.error(`Unknown Slack API method: ${method}`);
        return;
      }

      await fn(args);
    } catch (error: unknown) {
      const err = error as { code?: string; headers?: Headers };
      if (err.code === 'slack_webapi_platform_error' && err.headers) {
        const retryAfter = err.headers.get('retry-after');
        if (retryAfter) {
          this.logger.warn(
            `Rate limited for team ${teamId}, retrying after ${retryAfter}s`,
          );
          throw Worker.RateLimitError();
        }
      }

      this.logger.error(
        `Slack API error for team ${teamId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw error;
    }
  }
}
