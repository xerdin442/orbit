import { Test, TestingModule } from '@nestjs/testing';
import { CaddyService } from './caddy.service';
import { DbService } from '@src/db/db.service';

describe('CaddyService', () => {
  let service: CaddyService;
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;

    const module: TestingModule = await Test.createTestingModule({
      providers: [CaddyService, { provide: DbService, useValue: {} }],
    }).compile();

    service = module.get(CaddyService);
  });

  describe('enableAccessLogging', () => {
    it('points the default logger at JSON access-log entries and enables server logging', async () => {
      await service.enableAccessLogging();

      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        'http://localhost:2019/config/logging/logs/default',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({
            encoder: { format: 'json' },
            include: ['http.log.access'],
          }),
        }),
      );

      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        'http://localhost:2019/config/apps/http/servers/srv0/logs',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({}) }),
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
});
