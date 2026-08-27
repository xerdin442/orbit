import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CaddyController } from './caddy.controller';
import { DbService } from '@src/db/db.service';
import { DomainStatus } from '@generated/client';

describe('CaddyController', () => {
  let controller: CaddyController;
  let db: { domain: { findFirst: jest.Mock } };

  beforeEach(async () => {
    db = { domain: { findFirst: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CaddyController],
      providers: [{ provide: DbService, useValue: db }],
    }).compile();

    controller = module.get(CaddyController);
  });

  describe('tlsCheck', () => {
    it('authorizes a known active hostname', async () => {
      db.domain.findFirst.mockResolvedValue({ id: 'd1' });

      await expect(
        controller.tlsCheck('App.Example.Com'),
      ).resolves.toEqual({ ok: true });

      expect(db.domain.findFirst).toHaveBeenCalledWith({
        where: { hostname: 'app.example.com', status: DomainStatus.active },
        select: { id: true },
      });
    });

    it('rejects an unknown hostname', async () => {
      db.domain.findFirst.mockResolvedValue(null);

      await expect(controller.tlsCheck('nope.example.com')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects a missing domain query param', async () => {
      await expect(controller.tlsCheck(undefined)).rejects.toThrow(
        NotFoundException,
      );
      expect(db.domain.findFirst).not.toHaveBeenCalled();
    });
  });
});
