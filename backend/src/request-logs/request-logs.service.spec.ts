import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RequestLogsService } from './request-logs.service';
import { DbService } from '@src/db/db.service';
import type { RequestLogEntry } from '@src/common/types';

describe('RequestLogsService', () => {
  let service: RequestLogsService;
  let db: jest.Mocked<Pick<DbService, 'requestLog' | 'environment'>>;

  beforeEach(async () => {
    db = {
      requestLog: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      environment: { findFirst: jest.fn() },
    } as unknown as jest.Mocked<Pick<DbService, 'requestLog' | 'environment'>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [RequestLogsService, { provide: DbService, useValue: db }],
    }).compile();

    service = module.get(RequestLogsService);
  });

  const entry: RequestLogEntry = {
    environmentId: 'env-1',
    timestamp: new Date(),
    method: 'GET',
    uri: '/api/users',
    statusCode: 200,
    durationMs: 12,
    hostname: 'app.example.com',
  };

  describe('append', () => {
    it('persists to DB and emits to subscribers', async () => {
      db.requestLog.create = jest.fn().mockResolvedValue(entry);
      db.environment.findFirst = jest.fn().mockResolvedValue({ id: 'env-1' });

      const received: RequestLogEntry[] = [];
      const subscribed = await service.subscribeForUser('env-1', 'user-1');
      subscribed.subscribe((e) => received.push(e));

      await service.append(entry);

      expect(db.requestLog.create).toHaveBeenCalledWith({
        data: { ...entry, method: 'GET' },
      });
      expect(received).toHaveLength(1);
      expect(received[0].uri).toBe('/api/users');
    });

    it('does not throw when no one is subscribed', async () => {
      db.requestLog.create = jest.fn().mockResolvedValue(entry);
      await expect(service.append(entry)).resolves.toBeDefined();
    });

    it('uppercases the method before persisting', async () => {
      db.requestLog.create = jest.fn().mockResolvedValue(entry);

      await service.append({ ...entry, method: 'get' });

      expect(db.requestLog.create).toHaveBeenCalledWith({
        data: { ...entry, method: 'GET' },
      });
    });
  });

  describe('subscribeForUser', () => {
    it('throws if the environment is not owned by the user', async () => {
      db.environment.findFirst = jest.fn().mockResolvedValue(null);
      await expect(service.subscribeForUser('env-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the same stream for the same environmentId', async () => {
      db.environment.findFirst = jest.fn().mockResolvedValue({ id: 'env-1' });
      const a = await service.subscribeForUser('env-1', 'user-1');
      const b = await service.subscribeForUser('env-1', 'user-1');
      expect(a).toBe(b);
    });
  });

  describe('findByEnvironment', () => {
    it('throws if the environment is not owned by the user', async () => {
      db.environment.findFirst = jest.fn().mockResolvedValue(null);
      await expect(
        service.findByEnvironment('env-1', 'user-1', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('paginates and returns meta', async () => {
      db.environment.findFirst = jest.fn().mockResolvedValue({ id: 'env-1' });
      db.requestLog.findMany = jest.fn().mockResolvedValue([entry]);
      db.requestLog.count = jest.fn().mockResolvedValue(1);

      const result = await service.findByEnvironment('env-1', 'user-1', {
        page: 1,
        limit: 20,
      });

      expect(db.requestLog.findMany).toHaveBeenCalledWith({
        where: { environmentId: 'env-1' },
        orderBy: { timestamp: 'desc' },
        take: 20,
        skip: 0,
      });
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });
    });

    it('applies method and statusCode filters', async () => {
      db.environment.findFirst = jest.fn().mockResolvedValue({ id: 'env-1' });
      db.requestLog.findMany = jest.fn().mockResolvedValue([]);
      db.requestLog.count = jest.fn().mockResolvedValue(0);

      await service.findByEnvironment('env-1', 'user-1', {
        method: 'post',
        statusCode: 500,
        page: 1,
        limit: 20,
      });

      expect(db.requestLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            environmentId: 'env-1',
            method: 'POST',
            statusCode: 500,
          },
        }),
      );
    });

    it('applies a statusClass filter as a range', async () => {
      db.environment.findFirst = jest.fn().mockResolvedValue({ id: 'env-1' });
      db.requestLog.findMany = jest.fn().mockResolvedValue([]);
      db.requestLog.count = jest.fn().mockResolvedValue(0);

      await service.findByEnvironment('env-1', 'user-1', {
        statusClass: '4xx',
        page: 1,
        limit: 20,
      });

      expect(db.requestLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            environmentId: 'env-1',
            statusCode: { gte: 400, lt: 500 },
          },
        }),
      );
    });

    it('prefers an exact statusCode over statusClass when both are given', async () => {
      db.environment.findFirst = jest.fn().mockResolvedValue({ id: 'env-1' });
      db.requestLog.findMany = jest.fn().mockResolvedValue([]);
      db.requestLog.count = jest.fn().mockResolvedValue(0);

      await service.findByEnvironment('env-1', 'user-1', {
        statusCode: 404,
        statusClass: '5xx',
        page: 1,
        limit: 20,
      });

      expect(db.requestLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { environmentId: 'env-1', statusCode: 404 },
        }),
      );
    });
  });
});
