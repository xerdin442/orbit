import { Test, TestingModule } from '@nestjs/testing';
import { CaddyService } from './caddy.service';
import { DbService } from '@src/db/db.service';
import { DockerService } from '@src/infrastructure/docker.service';

describe('CaddyService', () => {
  let service: CaddyService;
  let fetchMock: jest.Mock;
  let db: {
    environment: { findUniqueOrThrow: jest.Mock };
    deployment: { findUniqueOrThrow: jest.Mock };
    domain: { findMany: jest.Mock };
  };
  let docker: {
    getOrCreateProjectNetwork: jest.Mock;
    connectContainerToNetwork: jest.Mock;
    inspectContainer: jest.Mock;
  };

  beforeEach(async () => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;

    db = {
      environment: { findUniqueOrThrow: jest.fn() },
      deployment: { findUniqueOrThrow: jest.fn() },
      domain: { findMany: jest.fn() },
    };

    docker = {
      getOrCreateProjectNetwork: jest
        .fn()
        .mockResolvedValue({ id: 'network-1' }),
      connectContainerToNetwork: jest.fn().mockResolvedValue(undefined),
      inspectContainer: jest
        .fn()
        .mockResolvedValue({ Name: '/project-proj-1-deployment-dep-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaddyService,
        { provide: DbService, useValue: db },
        { provide: DockerService, useValue: docker },
      ],
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
        project: { id: 'proj-1', healthCheckPort: 8080 },
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

      expect(docker.getOrCreateProjectNetwork).toHaveBeenCalledWith('proj-1');
      expect(docker.connectContainerToNetwork).toHaveBeenCalledWith(
        'network-1',
        'orbit-caddy',
      );

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:2019/config/apps/http/servers/srv0/routes/0',
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"container-1:8080"'),
        }),
      );
    });

    it('dials the container by its 12-char short ID, which Docker DNS can resolve', async () => {
      db.environment.findUniqueOrThrow.mockResolvedValue({
        id: 'env-1',
        currentDeploymentId: 'dep-1',
        project: { id: 'proj-1', healthCheckPort: 8080 },
      });
      db.deployment.findUniqueOrThrow.mockResolvedValue({
        id: 'dep-1',
        containerId:
          'cff6948fe1d450dbc2061e3ef59c126ef16814c6d8d1d4d57428269bd4429557',
      });
      db.domain.findMany.mockResolvedValue([{ hostname: 'app.example.com' }]);

      await service.syncEnvironment('env-1');

      expect(docker.inspectContainer).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:2019/config/apps/http/servers/srv0/routes/0',
        expect.objectContaining({
          body: expect.stringContaining('"cff6948fe1d4:8080"'),
        }),
      );
    });

    it('tolerates Caddy already being connected to the project network', async () => {
      db.environment.findUniqueOrThrow.mockResolvedValue({
        id: 'env-1',
        currentDeploymentId: 'dep-1',
        project: { id: 'proj-1', healthCheckPort: 8080 },
      });
      db.deployment.findUniqueOrThrow.mockResolvedValue({
        id: 'dep-1',
        containerId: 'container-1',
      });
      db.domain.findMany.mockResolvedValue([{ hostname: 'app.example.com' }]);
      docker.connectContainerToNetwork.mockRejectedValue(
        new Error('endpoint already exists'),
      );

      await expect(service.syncEnvironment('env-1')).resolves.not.toThrow();

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:2019/config/apps/http/servers/srv0/routes/0',
        expect.objectContaining({ method: 'PUT' }),
      );
    });

    it('removes any stale route before inserting, ahead of the catch-all', async () => {
      db.environment.findUniqueOrThrow.mockResolvedValue({
        id: 'env-1',
        currentDeploymentId: 'dep-1',
        project: { id: 'proj-1', healthCheckPort: 8080 },
      });
      db.deployment.findUniqueOrThrow.mockResolvedValue({
        id: 'dep-1',
        containerId: 'container-1',
      });
      db.domain.findMany.mockResolvedValue([{ hostname: 'app.example.com' }]);

      await service.syncEnvironment('env-1');

      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        'http://localhost:2019/id/orbit-route-app-example-com',
        expect.objectContaining({ method: 'DELETE' }),
      );

      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        'http://localhost:2019/config/apps/http/servers/srv0/routes/0',
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"container-1:8080"'),
        }),
      );
    });

    it('swallows a missing-route 404 when deleting a route that does not exist yet', async () => {
      db.environment.findUniqueOrThrow.mockResolvedValue({
        id: 'env-1',
        currentDeploymentId: 'dep-1',
        project: { id: 'proj-1', healthCheckPort: 8080 },
      });
      db.deployment.findUniqueOrThrow.mockResolvedValue({
        id: 'dep-1',
        containerId: 'container-1',
      });
      db.domain.findMany.mockResolvedValue([{ hostname: 'app.example.com' }]);

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              error: "unknown object ID 'orbit-route-app-example-com'",
            }),
          ),
      });
      fetchMock.mockResolvedValueOnce({ ok: true });

      await expect(service.syncEnvironment('env-1')).resolves.not.toThrow();

      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        'http://localhost:2019/config/apps/http/servers/srv0/routes/0',
        expect.objectContaining({ method: 'PUT' }),
      );
    });

    it('propagates delete errors unrelated to a missing object ID', async () => {
      db.environment.findUniqueOrThrow.mockResolvedValue({
        id: 'env-1',
        currentDeploymentId: 'dep-1',
        project: { id: 'proj-1', healthCheckPort: 8080 },
      });
      db.deployment.findUniqueOrThrow.mockResolvedValue({
        id: 'dep-1',
        containerId: 'container-1',
      });
      db.domain.findMany.mockResolvedValue([{ hostname: 'app.example.com' }]);

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: () => Promise.resolve('upstream connect error'),
      });

      await expect(service.syncEnvironment('env-1')).rejects.toThrow(
        'Caddy API error (502): upstream connect error',
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
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
