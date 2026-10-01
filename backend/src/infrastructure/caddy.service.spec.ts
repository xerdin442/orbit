import { Test, TestingModule } from '@nestjs/testing';
import { CaddyService } from './caddy.service';
import { DbService } from '@src/db/db.service';

describe('CaddyService', () => {
  let service: CaddyService;
  let fetchMock: jest.Mock;
  let db: jest.Mocked<Pick<DbService, 'environment' | 'deployment' | 'domain'>>;

  beforeEach(async () => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;

    db = {
      environment: { findUniqueOrThrow: jest.fn() },
      deployment: { findUniqueOrThrow: jest.fn() },
      domain: { findMany: jest.fn() },
    } as unknown as jest.Mocked<
      Pick<DbService, 'environment' | 'deployment' | 'domain'>
    >;

    const module: TestingModule = await Test.createTestingModule({
      providers: [CaddyService, { provide: DbService, useValue: db }],
    }).compile();

    service = module.get(CaddyService);
  });

  describe('enableAccessLogging', () => {
    it('points the default logger at JSON access-log entries and enables server logging', async () => {
      await service.enableAccessLogging();

      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        'http://localhost:2019/config/logging',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            logs: {
              default: {
                encoder: { format: 'json' },
                include: ['http.log.access'],
              },
            },
          }),
        }),
      );

      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        'http://localhost:2019/config/apps/http/servers/srv0/logs',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({}) }),
      );
    });

    it('throws when Caddy returns a non-ok response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('boom'),
      });

      await expect(service.enableAccessLogging()).rejects.toThrow(
        'Caddy API error (500): boom',
      );
    });
  });

  describe('syncEnvironment', () => {
    it("dials the deployment container on the project's healthCheckPort", async () => {
      db.environment.findUniqueOrThrow.mockResolvedValue({
        id: 'env-1',
        currentDeploymentId: 'dep-1',
        project: { healthCheckPort: 8080 },
      });
      db.deployment.findUniqueOrThrow.mockResolvedValue({
        id: 'dep-1',
        containerId: 'container-1',
      });
      db.domain.findMany.mockResolvedValue([{ hostname: 'app.example.com' }]);

      await service.syncEnvironment('env-1');

      expect(db.environment.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: 'env-1' },
        include: { project: true },
      });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:2019/id/orbit-route-app-example-com',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"container-1:8080"'),
        }),
      );
    });

    it('does nothing when the environment has no active deployment', async () => {
      db.environment.findUniqueOrThrow.mockResolvedValue({
        id: 'env-1',
        currentDeploymentId: null,
        project: { healthCheckPort: 3000 },
      });

      await service.syncEnvironment('env-1');

      expect(db.deployment.findUniqueOrThrow).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does nothing when the deployment has no container yet', async () => {
      db.environment.findUniqueOrThrow.mockResolvedValue({
        id: 'env-1',
        currentDeploymentId: 'dep-1',
        project: { healthCheckPort: 3000 },
      });
      db.deployment.findUniqueOrThrow.mockResolvedValue({
        id: 'dep-1',
        containerId: null,
      });

      await service.syncEnvironment('env-1');

      expect(db.domain.findMany).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
