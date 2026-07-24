import { ConfigureProxyStep } from '../configure-proxy.step';
import { CaddyService } from '@src/infrastructure/caddy.service';
import { DbService } from '@src/db/db.service';
import { LogService } from '@src/infrastructure/log.service';
import { ActivityService } from '@src/activity/activity.service';
import { DeploymentContext } from '@src/common/types';

const mockCtx = (): DeploymentContext =>
  ({
    deployment: { id: 'dep-1' },
    project: { name: 'my-app', id: 'proj-1', ownerId: 'user-1' },
    environment: { id: 'env-1' },
    containerId: 'container-1',
    domain: '',
  }) as DeploymentContext;

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

  it('reuses existing domain', async () => {
    db.domain.findFirst = jest
      .fn()
      .mockResolvedValue({ hostname: 'my-app-a1b2c3d4.orbit.app' });

    const ctx = mockCtx();
    await step.execute(ctx);

    expect(ctx.domain).toBe('my-app-a1b2c3d4.orbit.app');
    expect(db.domain.create).not.toHaveBeenCalled();
    expect(caddy.addRoute).toHaveBeenCalledWith(
      'my-app-a1b2c3d4.orbit.app',
      'container-1',
      3000,
    );
  });

  it('creates new domain when none exists', async () => {
    db.domain.findFirst = jest.fn().mockResolvedValue(null);
    db.domain.create = jest
      .fn()
      .mockResolvedValue({ id: 'd1', hostname: 'my-app-xxxxxxxx.orbit.app' });

    const ctx = mockCtx();
    await step.execute(ctx);

    expect(ctx.domain).toMatch(/^my-app-[a-f0-9]{8}\.orbit\.app$/);
    expect(db.domain.create).toHaveBeenCalled();
    expect(activity.log).toHaveBeenCalled();
    expect(caddy.addRoute).toHaveBeenCalled();
  });
});
