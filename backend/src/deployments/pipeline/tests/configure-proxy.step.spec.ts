jest.mock('@src/common/util', () => ({
  ...jest.requireActual('@src/common/util'),
  randomAlphanumeric: jest.fn(() => 'abc1234'),
}));

import { ConfigureProxyStep } from '../configure-proxy.step';
import { randomAlphanumeric } from '@src/common/util';
import { CaddyService } from '@src/infrastructure/caddy.service';
import { DbService } from '@src/db/db.service';
import { LogService } from '@src/infrastructure/log.service';
import { ActivityService } from '@src/activity/activity.service';
import {
  DeploymentContext,
  DeploymentStepExecutionError,
} from '@src/common/types';

const mockCtx = (): DeploymentContext =>
  ({
    deployment: { id: 'dep-1' },
    project: {
      name: 'my-app',
      id: 'proj-1',
      ownerId: 'user-1',
      source: { defaultBranch: 'main' },
    },
    environment: { id: 'env-1', name: 'production', branch: 'main' },
    containerId: 'container-1',
    domain: '',
  }) as DeploymentContext;

describe('ConfigureProxyStep', () => {
  let step: ConfigureProxyStep;
  let caddy: jest.Mocked<Pick<CaddyService, 'syncEnvironment'>>;
  let db: { domain: { findFirst: jest.Mock; create: jest.Mock } };
  let log: jest.Mocked<Pick<LogService, 'append'>>;
  let activity: jest.Mocked<Pick<ActivityService, 'log'>>;

  beforeEach(() => {
    // jest config sets resetMocks: true, which strips the factory implementation
    // before every test, so re-apply it here.
    (randomAlphanumeric as jest.Mock).mockReturnValue('abc1234');

    caddy = { syncEnvironment: jest.fn() };
    db = {
      domain: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };
    log = { append: jest.fn() };
    activity = { log: jest.fn() };

    step = new ConfigureProxyStep(
      caddy as unknown as CaddyService,
      db as unknown as DbService,
      log as unknown as LogService,
      activity as unknown as ActivityService,
    );
  });

  it('reuses existing managed domain', async () => {
    db.domain.findFirst = jest
      .fn()
      .mockResolvedValue({ hostname: 'my-app.192.168.1.55.sslip.io' } as any);

    const ctx = mockCtx();
    await step.execute(ctx);

    expect(ctx.domain).toBe('my-app.192.168.1.55.sslip.io');
    expect(db.domain.create).not.toHaveBeenCalled();
    expect(caddy.syncEnvironment).toHaveBeenCalledWith('env-1');
  });

  it('creates new managed hostname with a random suffix when none exists', async () => {
    db.domain.findFirst = jest.fn().mockResolvedValue(null);
    db.domain.create = jest.fn().mockResolvedValue({
      id: 'd1',
      hostname: 'my-app-abc1234.192.168.1.55.sslip.io',
    } as any);

    const ctx = mockCtx();
    await step.execute(ctx);

    expect(ctx.domain).toBe('my-app-abc1234.192.168.1.55.sslip.io');
    expect(db.domain.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        hostname: 'my-app-abc1234.192.168.1.55.sslip.io',
        type: 'managed',
        status: 'active',
      }),
    });
    expect(activity.log).toHaveBeenCalled();
    expect(caddy.syncEnvironment).toHaveBeenCalledWith('env-1');
  });

  it('re-rolls the suffix when the generated hostname is already taken', async () => {
    (randomAlphanumeric as jest.Mock)
      .mockReturnValueOnce('taken00')
      .mockReturnValueOnce('free123');

    db.domain.findFirst = jest
      .fn()
      // no existing managed domain for this environment
      .mockResolvedValueOnce(null)
      // first candidate hostname collides
      .mockResolvedValueOnce({ id: 'other' })
      // second candidate is free
      .mockResolvedValueOnce(null);
    db.domain.create = jest
      .fn()
      .mockImplementation(({ data }) => Promise.resolve({ id: 'd1', ...data }));

    const ctx = mockCtx();
    await step.execute(ctx);

    expect(ctx.domain).toBe('my-app-free123.192.168.1.55.sslip.io');
    expect(db.domain.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        hostname: 'my-app-free123.192.168.1.55.sslip.io',
      }),
    });
  });

  it('fails the step when it cannot find a free hostname', async () => {
    db.domain.findFirst = jest
      .fn()
      // no existing managed domain, then every candidate collides
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: 'other' });

    const ctx = mockCtx();

    await expect(step.execute(ctx)).rejects.toThrow(DeploymentStepExecutionError);
    expect(db.domain.create).not.toHaveBeenCalled();
    expect(caddy.syncEnvironment).not.toHaveBeenCalled();
  });

  it('includes the environment name for non-default branches', async () => {
    db.domain.findFirst = jest.fn().mockResolvedValue(null);
    db.domain.create = jest
      .fn()
      .mockImplementation(({ data }) => Promise.resolve({ id: 'd1', ...data }));

    const ctx = mockCtx();
    ctx.environment = { id: 'env-1', name: 'staging', branch: 'develop' } as any;
    await step.execute(ctx);

    expect(ctx.domain).toBe('my-app-staging-abc1234.192.168.1.55.sslip.io');
  });

  it('surfaces the underlying Caddy error when syncing fails', async () => {
    db.domain.findFirst = jest
      .fn()
      .mockResolvedValue({ hostname: 'my-app.192.168.1.55.sslip.io' } as any);
    caddy.syncEnvironment.mockRejectedValue(
      new Error('Caddy API error (502): upstream connect error'),
    );

    const ctx = mockCtx();

    await expect(step.execute(ctx)).rejects.toThrow(
      new DeploymentStepExecutionError(
        'Failed to route traffic and configure proxy: Caddy API error (502): upstream connect error',
      ),
    );
  });
});
