import { RequestLogIngestService } from './request-log-ingest.service';
import { DockerService } from '@src/infrastructure/docker.service';
import { CaddyService } from '@src/infrastructure/caddy.service';
import { DbService } from '@src/db/db.service';
import { RequestLogsService } from './request-logs.service';

describe('RequestLogIngestService', () => {
  let service: RequestLogIngestService;
  let docker: jest.Mocked<Pick<DockerService, 'followContainerLogs'>>;
  let caddy: jest.Mocked<Pick<CaddyService, 'enableAccessLogging'>>;
  let db: jest.Mocked<Pick<DbService, 'domain'>>;
  let requestLogs: jest.Mocked<Pick<RequestLogsService, 'append'>>;

  beforeEach(() => {
    docker = { followContainerLogs: jest.fn() };
    caddy = { enableAccessLogging: jest.fn() };
    db = { domain: { findFirst: jest.fn() } } as unknown as jest.Mocked<
      Pick<DbService, 'domain'>
    >;
    requestLogs = { append: jest.fn() };

    service = new RequestLogIngestService(
      docker as unknown as DockerService,
      caddy as unknown as CaddyService,
      db as unknown as DbService,
      requestLogs as unknown as RequestLogsService,
    );
  });

  describe('resolveEnvironmentId', () => {
    it('resolves via the domain table on a cache miss', async () => {
      db.domain.findFirst = jest
        .fn()
        .mockResolvedValue({ environmentId: 'env-1' });

      const result = await service.resolveEnvironmentId('app.example.com');

      expect(result).toBe('env-1');
      expect(db.domain.findFirst).toHaveBeenCalledWith({
        where: { hostname: 'app.example.com' },
      });
    });

    it('returns null and caches the miss for an unrecognized host', async () => {
      db.domain.findFirst = jest.fn().mockResolvedValue(null);

      const result = await service.resolveEnvironmentId('unknown.host');

      expect(result).toBeNull();

      await service.resolveEnvironmentId('unknown.host');
      expect(db.domain.findFirst).toHaveBeenCalledTimes(1);
    });

    it('serves repeat lookups from cache without hitting the DB again', async () => {
      db.domain.findFirst = jest
        .fn()
        .mockResolvedValue({ environmentId: 'env-1' });

      await service.resolveEnvironmentId('app.example.com');
      await service.resolveEnvironmentId('app.example.com');

      expect(db.domain.findFirst).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleLine', () => {
    it('appends a request log for a recognized, well-formed line', async () => {
      db.domain.findFirst = jest
        .fn()
        .mockResolvedValue({ environmentId: 'env-1' });

      const line = JSON.stringify({
        logger: 'http.log.access',
        request: { method: 'GET', host: 'app.example.com', uri: '/health' },
        status: 200,
        duration: 0.01,
      });

      await service.handleLine(line);

      expect(requestLogs.append).toHaveBeenCalledWith(
        expect.objectContaining({
          environmentId: 'env-1',
          method: 'GET',
          uri: '/health',
          statusCode: 200,
          durationMs: 10,
          hostname: 'app.example.com',
        }),
      );
    });

    it('does nothing for an unparseable line', async () => {
      await service.handleLine('not json');
      expect(requestLogs.append).not.toHaveBeenCalled();
    });

    it('does nothing for a host with no matching domain', async () => {
      db.domain.findFirst = jest.fn().mockResolvedValue(null);

      const line = JSON.stringify({
        logger: 'http.log.access',
        request: { method: 'GET', host: 'unknown.host', uri: '/' },
        status: 200,
        duration: 0.01,
      });

      await service.handleLine(line);

      expect(requestLogs.append).not.toHaveBeenCalled();
    });
  });
});
