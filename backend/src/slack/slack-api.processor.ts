import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Worker } from 'bullmq';
import {
  SlackError,
  WebAPIPlatformError,
  WebAPIRateLimitedError,
} from '@slack/web-api';
import { Logger } from '@src/common/logger';
import type { SlackApiJob } from '@src/common/types';
import { SlackApiService } from './slack-api.service';

@Processor('slack-api')
export class SlackApiProcessor extends WorkerHost {
  private readonly logger = Logger(SlackApiProcessor.name);

  constructor(private readonly slackApi: SlackApiService) {
    super();
  }

  async process(job: Job<SlackApiJob>): Promise<void> {
    const { teamId, method, args } = job.data;

    try {
      await this.slackApi.call(teamId, method, args);
    } catch (error) {
      if (error instanceof SlackError) {
        if (error instanceof WebAPIRateLimitedError) {
          this.logger.warn(`Rate limited for team ${teamId}, retrying...`);
          throw Worker.RateLimitError();
        }

        if (
          error instanceof WebAPIPlatformError &&
          ['invalid_auth', 'account_inactive', 'token_revoked'].includes(
            error.data.error,
          )
        ) {
          this.slackApi.invalidateClient(teamId);
        }

        this.logger.error(
          `Slack API error for team ${teamId}: ${error.message}`,
        );
      } else {
        this.logger.error(
          `Unexpected error for team ${teamId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      throw error;
    }
  }
}
