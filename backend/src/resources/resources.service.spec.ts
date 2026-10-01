import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ResourcesService } from './resources.service';
import { DbService } from '@src/db/db.service';
import { DockerService } from '@src/infrastructure/docker.service';
import { ActivityService } from '@src/activity/activity.service';
import { NotFoundException } from '@nestjs/common';
import { ResourceType, ResourceStatus } from '@generated/client';
import type { Queue } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';

describe('ResourcesService', () => {
  let service: ResourcesService;
  let db: jest.Mocked<Pick<DbService, 'environment' | 'resource'>>;
  let docker: jest.Mocked<
    Pick<DockerService, 'stopContainer' | 'removeContainer' | 'removeVolume'>
  >;
  let activity: jest.Mocked<Pick<ActivityService, 'log'>>;
  let queue: jest.Mocked<Pick<Queue, 'add'>>;

  beforeEach(async () => {
    db = {
      environment: { findFirst: jest.fn() },
      resource: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    } as unknown as jest.Mocked<Pick<DbService, 'environment' | 'resource'>>;
    docker = {
      stopContainer: jest.fn(),
      removeContainer: jest.fn(),
      removeVolume: jest.fn(),
    };
    activity = { log: jest.fn() };
    queue = { add: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResourcesService,
        { provide: DbService, useValue: db },
        { provide: DockerService, useValue: docker },
        { provide: ActivityService, useValue: activity },
        { provide: CACHE_MANAGER, useValue: { del: jest.fn() } },
        { provide: getQueueToken('resources'), useValue: queue },
      ],
    }).compile();

    service = module.get(ResourcesService);
  });

  describe('getDefaults', () => {
    it('returns defaults for requested types', () => {
      const result = service.getDefaults([
        ResourceType.redis,
        ResourceType.mongo,
      ]);
      expect(result.redis).toBeDefined();
      expect(result.mongo).toBeDefined();
      expect(result.postgres).toBeUndefined();
    });

    it('redis has REDIS_URL key', () => {
      const result = service.getDefaults([ResourceType.redis]);
      expect(result.redis!.some((k) => k.key === 'REDIS_URL')).toBe(true);
    });
  });

  describe('create', () => {
    it('throws if environment not found', async () => {
      db.environment.findFirst = jest.fn().mockResolvedValue(null);
      await expect(
        service.create('env-1', 'user-1', ResourceType.redis, 'my-redis', {
          REDIS_URL: '',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates resource and enqueues job', async () => {
      db.environment.findFirst = jest.fn().mockResolvedValue({ id: 'env-1' });
      db.resource.create = jest
        .fn()
        .mockResolvedValue({ id: 'res-1', type: ResourceType.redis });

      const result = await service.create(
        'env-1',
        'user-1',
        ResourceType.redis,
        'my-redis',
        { REDIS_URL: '' },
      );

      expect(result.id).toBe('res-1');
      expect(db.resource.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: ResourceType.redis,
          status: ResourceStatus.provisioning,
          credentials: { REDIS_URL: '' },
        }),
      });
      expect(queue.add).toHaveBeenCalledWith('provision', {
        resourceId: 'res-1',
      });
    });
  });

  describe('findById', () => {
    it('throws when not found', async () => {
      db.resource.findFirst = jest.fn().mockResolvedValue(null);
      await expect(service.findById('res-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('cleans up Docker resources and deletes', async () => {
      db.resource.findFirst = jest.fn().mockResolvedValue({
        id: 'res-1',
        containerId: 'c1',
        volumeId: 'v1',
        environment: { project: { ownerId: 'user-1' } },
      });

      await service.delete('res-1', 'user-1');

      expect(docker.stopContainer).toHaveBeenCalledWith('c1');
      expect(docker.removeContainer).toHaveBeenCalledWith('c1');
      expect(docker.removeVolume).toHaveBeenCalledWith('v1');
      expect(db.resource.delete).toHaveBeenCalledWith({
        where: { id: 'res-1' },
      });
      expect(activity.log).toHaveBeenCalled();
    });
  });

  describe('clearData', () => {
    it('throws if resource not found', async () => {
      db.resource.findFirst = jest.fn().mockResolvedValue(null);
      await expect(service.clearData('res-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws if resource is already provisioning', async () => {
      db.resource.findFirst = jest.fn().mockResolvedValue({
        id: 'res-1',
        status: ResourceStatus.provisioning,
        environment: { project: { ownerId: 'user-1' } },
      });
      await expect(service.clearData('res-1', 'user-1')).rejects.toThrow(
        'Resource is already being provisioned',
      );
    });

    it('sets status to provisioning and enqueues clear-data job', async () => {
      db.resource.findFirst = jest.fn().mockResolvedValue({
        id: 'res-1',
        status: ResourceStatus.ready,
        environment: { project: { ownerId: 'user-1' } },
      });

      const result = await service.clearData('res-1', 'user-1');

      expect(db.resource.update).toHaveBeenCalledWith({
        where: { id: 'res-1' },
        data: { status: ResourceStatus.provisioning },
      });
      expect(queue.add).toHaveBeenCalledWith('clear-data', {
        resourceId: 'res-1',
      });
      expect(result).toEqual({
        resourceId: 'res-1',
        status: ResourceStatus.provisioning,
      });
    });
  });
});
