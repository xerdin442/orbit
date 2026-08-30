import { DomainVerificationProcessor } from './domain-verification.processor';
import { DbService } from '@src/db/db.service';
import { CaddyService } from '@src/infrastructure/caddy.service';
import { ActivityService } from '@src/activity/activity.service';
import { DomainStatus } from '@generated/client';

const mockResolve4 = jest.fn();
const mockResolveCname = jest.fn();
const FAILURE_TIMEOUT_MS = 30 * 60 * 1000;

jest.mock('dns', () => ({
  resolve4: (...args: string[]) => mockResolve4(...args),
  resolveCname: (...args: string[]) => mockResolveCname(...args),
}));

jest.mock('util', () => ({
  ...jest.requireActual('util'),
  promisify: (fn: Function) => fn,
}));

describe('DomainVerificationProcessor', () => {
  let processor: DomainVerificationProcessor;
  let db: { domain: { findMany: jest.Mock; update: jest.Mock } };
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
      caddy as unknown as CaddyService,
      activity as unknown as ActivityService,
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

    await processor.process();

    expect(db.domain.update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: {
        status: DomainStatus.verifying,
        verificationTimeout: expect.any(Date),
      },
    });
    expect(db.domain.update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: expect.objectContaining({ status: DomainStatus.active }),
    });
  });

  it('verifies a non-apex domain whose CNAME the provider flattens to an A record', async () => {
    db.domain.findMany = jest.fn().mockResolvedValue([
      {
        id: 'd1',
        hostname: 'flat.example.com',
        status: DomainStatus.pending,
        createdAt: new Date(),
        environmentId: 'env-1',
      },
    ]);
    mockResolveCname.mockRejectedValue(new Error('ENODATA'));
    mockResolve4.mockResolvedValue(['192.168.1.55']);

    await processor.process();

    expect(db.domain.update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: expect.objectContaining({ status: DomainStatus.active }),
    });
    expect(caddy.syncEnvironment).toHaveBeenCalledWith('env-1');
  });

  it('marks failed once the verification timeout has elapsed', async () => {
    const pastTimeout = new Date(Date.now() - 60 * 1000);
    db.domain.findMany = jest.fn().mockResolvedValue([
      {
        id: 'd1',
        hostname: 'old.example.com',
        status: DomainStatus.verifying,
        createdAt: new Date(Date.now() - 31 * 60 * 1000),
        verificationTimeout: pastTimeout,
        environmentId: 'env-1',
      },
    ]);
    mockResolve4.mockResolvedValue(['10.0.0.1']);

    await processor.process();

    expect(db.domain.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: DomainStatus.failed } }),
    );
  });

  it('does not fail a domain re-entering verification even if it was created long ago', async () => {
    const futureTimeout = new Date(Date.now() + 29 * 60 * 1000);
    db.domain.findMany = jest.fn().mockResolvedValue([
      {
        id: 'd1',
        hostname: 'retried.example.com',
        status: DomainStatus.verifying,
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        verificationTimeout: futureTimeout,
        environmentId: 'env-1',
      },
    ]);
    mockResolve4.mockResolvedValue(['10.0.0.1']);

    await processor.process();

    const calls = db.domain.update.mock.calls as any[][];
    const statusUpdates = calls.map((c) => c[0].data.status as string);
    expect(statusUpdates).not.toContain(DomainStatus.failed);
  });

  it('skips recent verifying domain on DNS mismatch', async () => {
    db.domain.findMany = jest.fn().mockResolvedValue([
      {
        id: 'd1',
        hostname: 'new.example.com',
        status: DomainStatus.verifying,
        createdAt: new Date(),
        verificationTimeout: new Date(Date.now() + FAILURE_TIMEOUT_MS),
        environmentId: 'env-1',
      },
    ]);
    mockResolve4.mockResolvedValue(['10.0.0.1']);

    await processor.process();

    const calls = db.domain.update.mock.calls as any[][];
    const statusUpdates = calls.map((c) => c[0].data.status as string);
    expect(statusUpdates).not.toContain(DomainStatus.failed);
  });
});
