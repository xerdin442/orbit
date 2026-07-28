import { Test, TestingModule } from '@nestjs/testing';
import { CleanupService } from './cleanup.service';
import { CleanupProcessor } from './cleanup.processor';
import { DbService } from '@src/db/db.service';
import type { Queue, Job } from 'bull';
import type { CleanupJob } from '@src/common/types';

describe('CleanupService', () => {
  let service: CleanupService;
  let db: jest.Mocked<Pick<DbService, 'environment'>>;
  let queue: jest.Mocked<Pick<Queue, 'add'>>;

  beforeEach(async () => {
    db = {
      environment: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    } as unknown as jest.Mocked<Pick<DbService, 'environment'>>;
    queue = { add: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CleanupService,
        { provide: DbService, useValue: db },
        { provide: 'BullQueue_cleanup', useValue: queue },
      ],
    }).compile();

    service = module.get(CleanupService);
  });

  describe('enqueueProjectCleanup', () => {
    it('collects runtime ids and enqueues cleanup', async () => {
      db.environment.findMany.mockResolvedValue([
        {
          id: 'env-1',
          deployments: [{ containerId: 'dep-c1' }],
          resources: [{ containerId: 'res-c1', volumeId: 'res-v1' }],
        },
      ]);

      await service.enqueueProjectCleanup('proj-1');

      expect(queue.add).toHaveBeenCalledWith({
        projectId: 'proj-1',
        deploymentContainerIds: ['dep-c1'],
        resourceContainers: [{ containerId: 'res-c1', volumeId: 'res-v1' }],
        networkName: 'project-proj-1-network',
      });
    });
  });

  describe('enqueueEnvironmentCleanup', () => {
    it('collects runtime ids and enqueues cleanup', async () => {
      db.environment.findUnique.mockResolvedValue({
        id: 'env-1',
        deployments: [{ containerId: 'dep-c1' }],
        resources: [{ containerId: 'res-c1', volumeId: 'res-v1' }],
      });

      await service.enqueueEnvironmentCleanup('env-1');

      expect(queue.add).toHaveBeenCalledWith({
        environmentId: 'env-1',
        deploymentContainerIds: ['dep-c1'],
        resourceContainers: [{ containerId: 'res-c1', volumeId: 'res-v1' }],
      });
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

    await processor.handleCleanup(job);

    expect(docker.stopContainer).toHaveBeenCalledWith('dep-c1');
    expect(docker.removeContainer).toHaveBeenCalledWith('dep-c1');
    expect(docker.stopContainer).toHaveBeenCalledWith('res-c1');
    expect(docker.removeContainer).toHaveBeenCalledWith('res-c1');
    expect(docker.removeVolume).toHaveBeenCalledWith('res-v1');
    expect(docker.removeNetwork).toHaveBeenCalledWith('project-proj-1-network');
  });
});
