import { RequestLogPruneProcessor } from './request-log-prune.processor';
import { DbService } from '@src/db/db.service';

describe('RequestLogPruneProcessor', () => {
  let processor: RequestLogPruneProcessor;
  let db: jest.Mocked<Pick<DbService, 'requestLog'>>;

  beforeEach(() => {
    db = { requestLog: { deleteMany: jest.fn() } } as unknown as jest.Mocked<
      Pick<DbService, 'requestLog'>
    >;
    processor = new RequestLogPruneProcessor(db as unknown as DbService);
  });

  it('deletes request logs older than 7 days', async () => {
    db.requestLog.deleteMany = jest.fn().mockResolvedValue({ count: 3 });

    const before = Date.now() - 7 * 24 * 60 * 60 * 1000;
    await processor.process();

    expect(db.requestLog.deleteMany).toHaveBeenCalledTimes(1);
    const call = (db.requestLog.deleteMany as jest.Mock).mock.calls[0][0];
    const cutoff = call.where.timestamp.lt as Date;
    expect(cutoff.getTime()).toBeLessThanOrEqual(before + 1000);
    expect(cutoff.getTime()).toBeGreaterThan(before - 5000);
  });

  it('does not throw when nothing was pruned', async () => {
    db.requestLog.deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    await expect(processor.process()).resolves.toBeUndefined();
  });
});
