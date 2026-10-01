import type { Job } from 'bullmq';
import type { SlackApiJob } from '@src/common/types';
import { DbService } from '@src/db/db.service';
import { SlackApiService } from './slack-api.service';
import { SlackApiProcessor } from './slack-api.processor';

describe('SlackApiProcessor', () => {
  let processor: SlackApiProcessor;
  let db: {
    slackInstallation: {
      deleteMany: jest.Mock;
    };
  };
  let slackApi: jest.Mocked<Pick<SlackApiService, 'call'>>;

  beforeEach(() => {
    db = {
      slackInstallation: {
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    slackApi = { call: jest.fn() };
    processor = new SlackApiProcessor(
      slackApi as unknown as SlackApiService,
      db as unknown as DbService,
    );
  });

  it('clears inactive installations older than 20 days', async () => {
    const before = Date.now();

    await processor.process({
      name: 'cleanup-inactive-installations',
      data: {},
    } as Job<SlackApiJob>);

    const [query] = db.slackInstallation.deleteMany.mock.calls[0];
    const cutoff = query.where.updatedAt.lt.getTime();
    const expectedCutoff = before - 20 * 24 * 60 * 60 * 1000;

    expect(query).toEqual({
      where: {
        isActive: false,
        updatedAt: { lt: expect.any(Date) },
      },
    });
    expect(cutoff).toBeGreaterThanOrEqual(expectedCutoff);
    expect(cutoff).toBeLessThanOrEqual(Date.now() - 20 * 24 * 60 * 60 * 1000);
    expect(slackApi.call).not.toHaveBeenCalled();
  });
});
