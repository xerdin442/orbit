import { Processor, WorkerHost } from '@nestjs/bullmq';
import { DbService } from '@src/db/db.service';
import { Logger } from '@src/common/logger';

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Processor('request-logs')
export class RequestLogPruneProcessor extends WorkerHost {
  private readonly logger = Logger(RequestLogPruneProcessor.name);

  constructor(private readonly db: DbService) {
    super();
  }

  async process(): Promise<void> {
    const cutoff = new Date(Date.now() - RETENTION_MS);

    const { count } = await this.db.requestLog.deleteMany({
      where: { timestamp: { lt: cutoff } },
    });

    if (count > 0) {
      this.logger.info(
        `Pruned ${count} request log${count === 1 ? '' : 's'} older than ${cutoff.toISOString()}`,
      );
    }
  }
}
