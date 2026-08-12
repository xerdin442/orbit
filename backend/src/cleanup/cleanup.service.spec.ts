import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotFoundException } from '@nestjs/common';
import { CleanupService } from './cleanup.service';
import { CleanupProcessor } from './cleanup.processor';
import { DbService } from '@src/db/db.service';
import { ActivityService } from '@src/activity/activity.service';
import { DockerService } from '@src/infrastructure/docker.service';
import type { Queue, Job } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import type { CleanupJob } from '@src/common/types';

describe('CleanupService', () => {
  let service: CleanupService;
  let db: jest.Mocked<Pick<DbService, 'project' | 'environment'>>;
  let activity: jest.Mocked<Pick<ActivityService, 'log'>>;
  let cache: jest.Mocked<{ del: jest.Mock }>;
  let queue: jest.Mocked<Pick<Queue, 'add'>>;

  beforeEach(async () => {
    db = {
      project: { findFirst: jest.fn(), delete: jest.fn() },
      environment: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
    } as unknown as jest.Mocked<Pick<DbService, 'project' | 'environment'>>;
    activity = { log: jest.fn() };
    cache = { del: jest.fn() };
    queue = { add: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CleanupService,
        { provide: DbService, useValue: db },
        { provide: ActivityService, useValue: activity },
        { provide: CACHE_MANAGER, useValue: cache },
        { provide: getQueueToken('cleanup'), useValue: queue },
      ],
    }).compile();

    service = module.get(CleanupService);
  });

  describe('enqueueProjectCleanup', () => {
    it('deletes the project, logs activity, invalidates cache, and enqueues infra cleanup', async () => {
      db.project.findFirst.mockResolvedValue({
        id: 'proj-1',
        ownerId: 'user-1',
      });
      db.environment.findMany.mockResolvedValue([
        {
          id: 'env-1',
          deployments: [{ containerId: 'dep-c1' }],
          resources: [{ containerId: 'res-c1', volumeId: 'res-v1' }],
        },
      ]);

      await service.enqueueProjectCleanup('proj-1', 'user-1');

      expect(db.project.delete).toHaveBeenCalledWith({
        where: { id: 'proj-1' },
      });
      expect(activity.log).toHaveBeenCalledWith('project_deleted', 'user-1', {
        projectId: 'proj-1',
      });
      expect(cache.del).toHaveBeenCalledWith('/api/projects/proj-1');
      expect(cache.del).toHaveBeenCalledWith(
        '/api/projects/proj-1/environments',
      );
      expect(queue.add).toHaveBeenCalledWith('project-cleanup', {
        projectId: 'proj-1',
        deploymentContainerIds: ['dep-c1'],
        resourceContainers: [{ containerId: 'res-c1', volumeId: 'res-v1' }],
        networkName: 'project-proj-1-network',
      });
    });

    it('throws if the project does not exist or is not owned by the caller', async () => {
      db.project.findFirst.mockResolvedValue(null);

      await expect(
        service.enqueueProjectCleanup('proj-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);

      expect(db.project.delete).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('enqueueEnvironmentCleanup', () => {
    it('deletes the environment, logs activity, and enqueues cleanup', async () => {
      db.environment.findUnique.mockResolvedValue({
        id: 'env-1',
        projectId: 'proj-1',
        project: { ownerId: 'user-1' },
        deployments: [{ containerId: 'dep-c1' }],
        resources: [{ containerId: 'res-c1', volumeId: 'res-v1' }],
      });

      await service.enqueueEnvironmentCleanup('env-1', 'user-1');

      expect(db.environment.delete).toHaveBeenCalledWith({
        where: { id: 'env-1' },
      });
      expect(activity.log).toHaveBeenCalledWith(
        'environment_deleted',
        'user-1',
        { projectId: 'proj-1', environmentId: 'env-1' },
      );
      expect(queue.add).toHaveBeenCalledWith('environment-cleanup', {
        environmentId: 'env-1',
        deploymentContainerIds: ['dep-c1'],
        resourceContainers: [{ containerId: 'res-c1', volumeId: 'res-v1' }],
      });
    });

    it('throws if the environment does not exist', async () => {
      db.environment.findUnique.mockResolvedValue(null);

      await expect(
        service.enqueueEnvironmentCleanup('env-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);

      expect(db.environment.delete).not.toHaveBeenCalled();
    });

    it('throws if the environment is not owned by the caller', async () => {
      db.environment.findUnique.mockResolvedValue({
        id: 'env-1',
        projectId: 'proj-1',
        project: { ownerId: 'someone-else' },
        deployments: [],
        resources: [],
      });

      await expect(
        service.enqueueEnvironmentCleanup('env-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);

      expect(db.environment.delete).not.toHaveBeenCalled();
    });
  });
});

describe('CleanupProcessor', () => {
  let processor: CleanupProcessor;
  let docker: jest.Mocked<
    Pick<
      DockerService,
      'stopContainer' | 'removeContainer' | 'removeVolume' | 'removeNetwork'
    >
  >;

  beforeEach(async () => {
    docker = {
      stopContainer: jest.fn(),
      removeContainer: jest.fn(),
      removeVolume: jest.fn(),
      removeNetwork: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CleanupProcessor,
        { provide: DockerService, useValue: docker },
      ],
    }).compile();

    processor = module.get(CleanupProcessor);
  });

  it('cleans up containers, volumes, and networks', async () => {
    const job = {
      data: {
        projectId: 'proj-1',
        deploymentContainerIds: ['dep-c1'],
        resourceContainers: [{ containerId: 'res-c1', volumeId: 'res-v1' }],
        networkName: 'project-proj-1-network',
      },
    } as Job<CleanupJob>;

    await processor.process(job);

    expect(docker.stopContainer).toHaveBeenCalledWith('dep-c1');
    expect(docker.removeContainer).toHaveBeenCalledWith('dep-c1');
    expect(docker.stopContainer).toHaveBeenCalledWith('res-c1');
    expect(docker.removeContainer).toHaveBeenCalledWith('res-c1');
    expect(docker.removeVolume).toHaveBeenCalledWith('res-v1');
    expect(docker.removeNetwork).toHaveBeenCalledWith('project-proj-1-network');
  });
});
