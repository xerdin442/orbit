import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import type { SlackApiJob } from '@src/common/types';

@Injectable()
export class SlackApiService {
  constructor(
    @InjectQueue('slack-api') private readonly queue: Queue<SlackApiJob>,
  ) {}

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
