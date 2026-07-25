import { DomainVerificationProcessor } from './domain-verification.processor';
import { DbService } from '@src/db/db.service';
import { CaddyService } from '@src/infrastructure/caddy.service';
import { ActivityService } from '@src/activity/activity.service';
import { DomainStatus } from '@generated/client';

const mockResolve4 = jest.fn();
const mockResolveCname = jest.fn();

jest.mock('dns', () => ({
  resolve4: (...args: any[]) => mockResolve4(...args),
  resolveCname: (...args: any[]) => mockResolveCname(...args),
}));

jest.mock('util', () => ({
  ...jest.requireActual('util'),
  promisify: (fn: Function) => fn,
}));

describe('DomainVerificationProcessor', () => {
  let processor: DomainVerificationProcessor;
  let db: jest.Mocked<Pick<DbService, 'domain'>>;
  let caddy: jest.Mocked<Pick<CaddyService, 'syncEnvironment'>>;
  let activity: jest.Mocked<Pick<ActivityService, 'log'>>;

  beforeEach(() => {
    jest.clearAllMocks();

    db = {
      domain: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    caddy = { syncEnvironment: jest.fn() };
    activity = { log: jest.fn() };

    processor = new DomainVerificationProcessor(
      db as unknown as DbService,
      caddy as CaddyService,
      activity as ActivityService,
    );
  });

  it('sets pending domain to verifying and marks active on success', async () => {
    db.domain.findMany = jest.fn().mockResolvedValue([
      {
        id: 'd1',
        hostname: 'api.example.com',
        status: DomainStatus.pending,
        createdAt: new Date(),
        environmentId: 'env-1',
      },
    ]);
    mockResolveCname.mockResolvedValue(['192.168.1.55.sslip.io']);

    await processor.verifyDomains();

    expect(db.domain.update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: { status: DomainStatus.verifying },
    });
    expect(db.domain.update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: expect.objectContaining({ status: DomainStatus.active }),
    });
  });

  it('marks failed after 30 minutes', async () => {
    const oldDate = new Date(Date.now() - 31 * 60 * 1000);
    db.domain.findMany = jest.fn().mockResolvedValue([
      {
        id: 'd1',
        hostname: 'old.example.com',
        status: DomainStatus.verifying,
        createdAt: oldDate,
        environmentId: 'env-1',
      },
    ]);
    mockResolve4.mockResolvedValue(['10.0.0.1']);

    await processor.verifyDomains();

    expect(db.domain.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: DomainStatus.failed } }),
    );
  });

  it('skips recent verifying domain on DNS mismatch', async () => {
    db.domain.findMany = jest.fn().mockResolvedValue([
      {
        id: 'd1',
        hostname: 'new.example.com',
        status: DomainStatus.verifying,
        createdAt: new Date(),
        environmentId: 'env-1',
      },
    ]);
    mockResolve4.mockResolvedValue(['10.0.0.1']);

    await processor.verifyDomains();

    const calls = (db.domain.update as jest.Mock).mock.calls as any[][];
    const statusUpdates = calls.map((c) => c[0].data.status as string);
    expect(statusUpdates).not.toContain(DomainStatus.failed);
  });
});
