import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { DomainsService } from './domains.service';
import { DbService } from '@src/db/db.service';
import { ActivityService } from '@src/activity/activity.service';
import { CaddyService } from '@src/infrastructure/caddy.service';
import {
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { DomainType, DomainStatus } from '@generated/client';

describe('DomainsService', () => {
  let service: DomainsService;
  let db: jest.Mocked<Pick<DbService, 'environment' | 'domain'>>;
  let activity: jest.Mocked<Pick<ActivityService, 'log'>>;
  let caddy: jest.Mocked<Pick<CaddyService, 'deleteRoute'>>;

  beforeEach(async () => {
    db = {
      environment: { findFirst: jest.fn() },
      domain: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn(),
        delete: jest.fn(),
      },
    } as unknown as jest.Mocked<Pick<DbService, 'environment' | 'domain'>>;
    activity = { log: jest.fn() };
    caddy = { deleteRoute: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DomainsService,
        { provide: DbService, useValue: db },
        { provide: ActivityService, useValue: activity },
        { provide: CaddyService, useValue: caddy },
        { provide: CACHE_MANAGER, useValue: { del: jest.fn() } },
      ],
    }).compile();

    service = module.get(DomainsService);
  });

  describe('addCustomDomain', () => {
    it('throws if environment not found', async () => {
      db.environment.findFirst = jest.fn().mockResolvedValue(null);
      await expect(
        service.addCustomDomain('env-1', 'api.example.com', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws if domain already registered', async () => {
      db.environment.findFirst = jest.fn().mockResolvedValue({ id: 'env-1' });
      db.domain.findFirst = jest
        .fn()
        .mockResolvedValue({ hostname: 'api.example.com' });

      await expect(
        service.addCustomDomain('env-1', 'api.example.com', 'user-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('creates custom domain and returns DNS instructions for subdomain', async () => {
      db.environment.findFirst = jest.fn().mockResolvedValue({ id: 'env-1' });
      db.domain.findFirst = jest.fn().mockResolvedValue(null);
      db.domain.create = jest.fn().mockResolvedValue({
        id: 'd1',
        hostname: 'api.example.com',
        type: DomainType.custom,
        status: DomainStatus.pending,
      });

      const result = await service.addCustomDomain(
        'env-1',
        'api.example.com',
        'user-1',
      );

      expect(db.domain.create).toHaveBeenCalledWith({
        data: {
          hostname: 'api.example.com',
          type: DomainType.custom,
          status: DomainStatus.pending,
          environmentId: 'env-1',
        },
      });
      expect(activity.log).toHaveBeenCalled();
      expect(result).toEqual({
        recordType: 'CNAME',
        host: 'api',
        value: '192.168.1.55.sslip.io',
      });
    });

    it('returns A record for apex domain', async () => {
      db.environment.findFirst = jest.fn().mockResolvedValue({ id: 'env-1' });
      db.domain.findFirst = jest.fn().mockResolvedValue(null);
      db.domain.create = jest.fn().mockResolvedValue({
        id: 'd1',
        hostname: 'example.com',
        type: DomainType.custom,
        status: DomainStatus.pending,
      });

      const result = await service.addCustomDomain(
        'env-1',
        'example.com',
        'user-1',
      );

      expect(result).toEqual({
        recordType: 'A',
        host: '@',
        value: '192.168.1.55',
      });
    });

    it('throws if the environment has reached the custom domain cap', async () => {
      db.environment.findFirst = jest.fn().mockResolvedValue({ id: 'env-1' });
      db.domain.findFirst = jest.fn().mockResolvedValue(null);
      db.domain.count = jest.fn().mockResolvedValue(5);

      await expect(
        service.addCustomDomain('env-1', 'api.example.com', 'user-1'),
      ).rejects.toThrow(ConflictException);
      expect(db.domain.create).not.toHaveBeenCalled();
    });

    it('counts only custom domains in the target environment', async () => {
      db.environment.findFirst = jest.fn().mockResolvedValue({ id: 'env-1' });
      db.domain.findFirst = jest.fn().mockResolvedValue(null);
      db.domain.create = jest.fn().mockResolvedValue({
        id: 'd1',
        hostname: 'api.example.com',
        type: DomainType.custom,
        status: DomainStatus.pending,
      });

      await service.addCustomDomain('env-1', 'api.example.com', 'user-1');

      expect(db.domain.count).toHaveBeenCalledWith({
        where: { environmentId: 'env-1', type: DomainType.custom },
      });
    });
  });

  describe('deleteDomain', () => {
    it('throws if not found', async () => {
      db.domain.findFirst = jest.fn().mockResolvedValue(null);
      await expect(service.deleteDomain('d1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws if managed hostname', async () => {
      db.domain.findFirst = jest.fn().mockResolvedValue({
        id: 'd1',
        type: DomainType.managed,
      });
      await expect(service.deleteDomain('d1', 'user-1')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('deletes custom domain', async () => {
      db.domain.findFirst = jest.fn().mockResolvedValue({
        id: 'd1',
        type: DomainType.custom,
        hostname: 'api.example.com',
        environmentId: 'env-1',
      });

      await service.deleteDomain('d1', 'user-1');

      expect(db.domain.delete).toHaveBeenCalledWith({ where: { id: 'd1' } });
      expect(caddy.deleteRoute).toHaveBeenCalledWith('api.example.com');
      expect(activity.log).toHaveBeenCalled();
    });
  });

  describe('retryVerification', () => {
    it('throws if not found', async () => {
      db.domain.findFirst = jest.fn().mockResolvedValue(null);
      await expect(service.retryVerification('d1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws if managed hostname', async () => {
      db.domain.findFirst = jest.fn().mockResolvedValue({
        id: 'd1',
        type: DomainType.managed,
        status: DomainStatus.failed,
      });
      await expect(service.retryVerification('d1', 'user-1')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws if domain has not failed', async () => {
      db.domain.findFirst = jest.fn().mockResolvedValue({
        id: 'd1',
        type: DomainType.custom,
        status: DomainStatus.verifying,
      });
      await expect(service.retryVerification('d1', 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('resets a failed custom domain to pending', async () => {
      db.domain.findFirst = jest.fn().mockResolvedValue({
        id: 'd1',
        type: DomainType.custom,
        status: DomainStatus.failed,
        hostname: 'api.example.com',
        environmentId: 'env-1',
      });
      db.domain.update = jest.fn().mockResolvedValue({
        id: 'd1',
        type: DomainType.custom,
        status: DomainStatus.pending,
        hostname: 'api.example.com',
        environmentId: 'env-1',
        verificationTimeout: null,
      });

      const result = await service.retryVerification('d1', 'user-1');

      expect(db.domain.update).toHaveBeenCalledWith({
        where: { id: 'd1' },
        data: { status: DomainStatus.pending, verificationTimeout: null },
      });
      expect(activity.log).toHaveBeenCalled();
      expect(result.status).toBe(DomainStatus.pending);
    });
  });

  describe('findByEnvironment', () => {
    it('queries domains for environment', async () => {
      db.environment.findFirst = jest.fn().mockResolvedValue({ id: 'env-1' });
      db.domain.findMany = jest.fn().mockResolvedValue([]);
      await service.findByEnvironment('env-1', 'user-1');
      expect(db.domain.findMany).toHaveBeenCalledWith({
        where: { environmentId: 'env-1' },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('findOne', () => {
    it('throws if not found', async () => {
      db.domain.findFirst = jest.fn().mockResolvedValue(null);
      await expect(service.findOne('d1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the domain when owned by the user', async () => {
      const domain = {
        id: 'd1',
        type: DomainType.custom,
        hostname: 'api.example.com',
        status: DomainStatus.active,
        environmentId: 'env-1',
      };
      db.domain.findFirst = jest.fn().mockResolvedValue(domain);

      const result = await service.findOne('d1', 'user-1');

      expect(db.domain.findFirst).toHaveBeenCalledWith({
        where: { id: 'd1', environment: { project: { ownerId: 'user-1' } } },
      });
      expect(result).toEqual(domain);
    });
  });

  describe('getInstructions', () => {
    it('throws if not found', async () => {
      db.domain.findFirst = jest.fn().mockResolvedValue(null);
      await expect(service.getInstructions('d1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws if domain is active', async () => {
      db.domain.findFirst = jest.fn().mockResolvedValue({
        id: 'd1',
        hostname: 'api.example.com',
        status: DomainStatus.active,
      });
      await expect(service.getInstructions('d1', 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws if domain has failed', async () => {
      db.domain.findFirst = jest.fn().mockResolvedValue({
        id: 'd1',
        hostname: 'api.example.com',
        status: DomainStatus.failed,
      });
      await expect(service.getInstructions('d1', 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('returns CNAME instructions for a pending subdomain', async () => {
      db.domain.findFirst = jest.fn().mockResolvedValue({
        id: 'd1',
        hostname: 'api.example.com',
        status: DomainStatus.pending,
      });

      const result = await service.getInstructions('d1', 'user-1');

      expect(result).toEqual({
        recordType: 'CNAME',
        host: 'api',
        value: '192.168.1.55.sslip.io',
      });
    });

    it('returns A record instructions for a verifying apex domain', async () => {
      db.domain.findFirst = jest.fn().mockResolvedValue({
        id: 'd1',
        hostname: 'example.com',
        status: DomainStatus.verifying,
      });

      const result = await service.getInstructions('d1', 'user-1');

      expect(result).toEqual({
        recordType: 'A',
        host: '@',
        value: '192.168.1.55',
      });
    });
  });
});
