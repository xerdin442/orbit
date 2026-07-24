import { Test, TestingModule } from '@nestjs/testing';
import { ResourcesService } from './resources.service';
import { DbService } from '@src/db/db.service';
import { DockerService } from '@src/infrastructure/docker.service';
import { ActivityService } from '@src/activity/activity.service';
import { NotFoundException } from '@nestjs/common';
import { ResourceType, ResourceStatus } from '@generated/client';
import type { Queue } from 'bull';

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
      environment: { findUnique: jest.fn() },
      resource: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
    };
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
        { provide: 'BullQueue_resources', useValue: queue },
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
      db.environment.findUnique = jest.fn().mockResolvedValue(null);
      await expect(
        service.create('env-1', ResourceType.redis, 'my-redis', {
          REDIS_URL: '',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates resource and enqueues job', async () => {
      db.environment.findUnique = jest.fn().mockResolvedValue({ id: 'env-1' });
      db.resource.create = jest
        .fn()
        .mockResolvedValue({ id: 'res-1', type: ResourceType.redis });

      const result = await service.create(
        'env-1',
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
      expect(queue.add).toHaveBeenCalledWith({ resourceId: 'res-1' });
    });
  });

  describe('findById', () => {
    it('throws when not found', async () => {
      db.resource.findUnique = jest.fn().mockResolvedValue(null);
      await expect(service.findById('res-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('cleans up Docker resources and deletes', async () => {
      db.resource.findUnique = jest.fn().mockResolvedValue({
        id: 'res-1',
        containerId: 'c1',
        volumeId: 'v1',
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
});
