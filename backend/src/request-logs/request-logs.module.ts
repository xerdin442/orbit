import { Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { RequestLogsService } from './request-logs.service';
import { RequestLogsController } from './request-logs.controller';
import { RequestLogIngestService } from './request-log-ingest.service';
import { RequestLogPruneProcessor } from './request-log-prune.processor';

@Module({
  imports: [BullModule.registerQueue({ name: 'request-logs' })],
  controllers: [RequestLogsController],
  providers: [
    RequestLogsService,
    RequestLogIngestService,
    RequestLogPruneProcessor,
  ],
})
export class RequestLogsModule implements OnModuleInit {
  constructor(
    @InjectQueue('request-logs') private readonly requestLogsQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.requestLogsQueue.add(
      'prune',
      {},
      {
        repeat: { every: 60 * 60 * 1000 },
        removeOnComplete: true,
      },
    );
  }
}
