import { RequestLogIngestService } from './request-log-ingest.service';
import { DockerService } from '@src/infrastructure/docker.service';
import { CaddyService } from '@src/infrastructure/caddy.service';
import { DbService } from '@src/db/db.service';
import { RequestLogsService } from './request-logs.service';
import { BURST_MIN_REQUESTS, BURST_PURGE_WINDOW_MS } from './filters';

describe('RequestLogIngestService', () => {
  let service: RequestLogIngestService;
  let docker: jest.Mocked<Pick<DockerService, 'followContainerLogs'>>;
  let caddy: jest.Mocked<Pick<CaddyService, 'enableAccessLogging'>>;
  let db: jest.Mocked<Pick<DbService, 'domain'>>;
  let requestLogs: jest.Mocked<
    Pick<RequestLogsService, 'append' | 'deleteRecentByClientIp'>
  >;

  beforeEach(() => {
    docker = { followContainerLogs: jest.fn() };
    caddy = { enableAccessLogging: jest.fn() };
    db = { domain: { findFirst: jest.fn() } } as unknown as jest.Mocked<
      Pick<DbService, 'domain'>
    >;
    requestLogs = {
      append: jest.fn(),
      deleteRecentByClientIp: jest.fn().mockResolvedValue(0),
    };

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
        'env-1',
        expect.objectContaining({
          method: 'GET',
          path: '/health',
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

    it('stops appending once a client IP trips the burst detector', async () => {
      db.domain.findFirst = jest
        .fn()
        .mockResolvedValue({ environmentId: 'env-1' });

      const line = (path: string) =>
        JSON.stringify({
          logger: 'http.log.access',
          request: {
            method: 'GET',
            host: 'app.example.com',
            uri: path,
            remote_ip: '198.51.100.7',
          },
          status: 404,
          duration: 0.01,
        });

      for (let i = 0; i < BURST_MIN_REQUESTS; i++) {
        await service.handleLine(line(`/probe-${i}`));
      }

      // the first BURST_MIN_REQUESTS - 1 requests are below threshold and get
      // appended; the one that crosses BURST_MIN_REQUESTS trips the detector
      expect(requestLogs.append).toHaveBeenCalledTimes(BURST_MIN_REQUESTS - 1);

      await service.handleLine(line('/probe-after-trip'));
      expect(requestLogs.append).toHaveBeenCalledTimes(BURST_MIN_REQUESTS - 1);
    });

    it('purges the already-stored rows of a flagged IP exactly once', async () => {
      db.domain.findFirst = jest
        .fn()
        .mockResolvedValue({ environmentId: 'env-1' });

      const line = (path: string) =>
        JSON.stringify({
          logger: 'http.log.access',
          request: {
            method: 'GET',
            host: 'app.example.com',
            uri: path,
            client_ip: '198.51.100.7',
          },
          status: 404,
          duration: 0.01,
        });

      for (let i = 0; i < BURST_MIN_REQUESTS + 10; i++) {
        await service.handleLine(line(`/probe-${i}`));
      }

      expect(requestLogs.deleteRecentByClientIp).toHaveBeenCalledTimes(1);
      expect(requestLogs.deleteRecentByClientIp).toHaveBeenCalledWith(
        '198.51.100.7',
        BURST_PURGE_WINDOW_MS,
      );
    });

    it('stores the client IP on rows that pass', async () => {
      db.domain.findFirst = jest
        .fn()
        .mockResolvedValue({ environmentId: 'env-1' });

      await service.handleLine(
        JSON.stringify({
          logger: 'http.log.access',
          request: {
            method: 'GET',
            host: 'app.example.com',
            uri: '/health',
            client_ip: '203.0.113.9',
          },
          status: 200,
          duration: 0.01,
        }),
      );

      expect(requestLogs.append).toHaveBeenCalledWith(
        'env-1',
        expect.objectContaining({ clientIp: '203.0.113.9' }),
      );
    });

    it('keeps dropping the burst even if the purge itself fails', async () => {
      db.domain.findFirst = jest
        .fn()
        .mockResolvedValue({ environmentId: 'env-1' });
      requestLogs.deleteRecentByClientIp.mockRejectedValue(
        new Error('db down'),
      );

      const line = (path: string) =>
        JSON.stringify({
          logger: 'http.log.access',
          request: {
            method: 'GET',
            host: 'app.example.com',
            uri: path,
            client_ip: '198.51.100.8',
          },
          status: 404,
          duration: 0.01,
        });

      for (let i = 0; i < BURST_MIN_REQUESTS; i++) {
        await service.handleLine(line(`/probe-${i}`));
      }
      const before = requestLogs.append.mock.calls.length;

      await expect(service.handleLine(line('/after'))).resolves.toBeUndefined();
      expect(requestLogs.append.mock.calls.length).toBe(before);
    });

    it('never drops GitHub webhook traffic for burst volume', async () => {
      db.domain.findFirst = jest
        .fn()
        .mockResolvedValue({ environmentId: 'env-1' });

      const line = JSON.stringify({
        logger: 'http.log.access',
        request: {
          method: 'POST',
          host: 'api.orbit.example.com',
          uri: '/api/github/webhook',
          remote_ip: '140.82.112.1',
        },
        status: 200,
        duration: 0.01,
      });

      for (let i = 0; i < BURST_MIN_REQUESTS + 10; i++) {
        await service.handleLine(line);
      }

      expect(requestLogs.append).toHaveBeenCalledTimes(BURST_MIN_REQUESTS + 10);
    });
  });
});
