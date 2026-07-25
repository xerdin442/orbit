import { ConfigureProxyStep } from '../configure-proxy.step';
import { CaddyService } from '@src/infrastructure/caddy.service';
import { DbService } from '@src/db/db.service';
import { LogService } from '@src/infrastructure/log.service';
import { ActivityService } from '@src/activity/activity.service';
import { DeploymentContext } from '@src/common/types';

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
  } as DeploymentContext);

describe('ConfigureProxyStep', () => {
  let step: ConfigureProxyStep;
  let caddy: jest.Mocked<Pick<CaddyService, 'addRoute'>>;
  let db: jest.Mocked<Pick<DbService, 'domain'>>;
  let log: jest.Mocked<Pick<LogService, 'append'>>;
  let activity: jest.Mocked<Pick<ActivityService, 'log'>>;

  beforeEach(() => {
    caddy = { addRoute: jest.fn() };
    db = {
      domain: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };
    log = { append: jest.fn() };
    activity = { log: jest.fn() };

    step = new ConfigureProxyStep(
      caddy as CaddyService,
      db as DbService,
      log as LogService,
      activity as ActivityService,
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
    expect(caddy.addRoute).toHaveBeenCalledWith(
      'my-app.192.168.1.55.sslip.io',
      'container-1',
      3000,
    );
  });

  it('creates new managed hostname when none exists', async () => {
    db.domain.findFirst = jest.fn().mockResolvedValue(null);
    db.domain.create = jest
      .fn()
      .mockResolvedValue({ id: 'd1', hostname: 'my-app.192.168.1.55.sslip.io' } as any);

    const ctx = mockCtx();
    await step.execute(ctx);

    expect(ctx.domain).toBe('my-app.192.168.1.55.sslip.io');
    expect(db.domain.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        hostname: 'my-app.192.168.1.55.sslip.io',
        type: 'managed',
        status: 'active',
      }),
    });
    expect(activity.log).toHaveBeenCalled();
    expect(caddy.addRoute).toHaveBeenCalled();
  });
});
