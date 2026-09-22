import { ResourceProcessor } from './resource.processor';
import { DbService } from '@src/db/db.service';
import { DockerService } from '@src/infrastructure/docker.service';
import { ActivityService } from '@src/activity/activity.service';
import { ResourceType, ResourceStatus } from '@generated/client';
import type { Job } from 'bullmq';
import type { ResourceJob } from '@src/common/types';

function buildJob(overrides: Partial<ResourceJob> = {}): Job<ResourceJob> {
  return {
    name: 'provision',
    data: { resourceId: 'res-1', ...overrides },
  } as unknown as Job<ResourceJob>;
}

describe('ResourceProcessor', () => {
  let processor: ResourceProcessor;
  let db: {
    resource: { findUniqueOrThrow: jest.Mock; update: jest.Mock };
    environment: { findUniqueOrThrow: jest.Mock };
  };
  let docker: jest.Mocked<
    Pick<
      DockerService,
      | 'createVolume'
      | 'pullImage'
      | 'createContainer'
      | 'startContainer'
      | 'checkContainerHealth'
      | 'stopContainer'
      | 'removeContainer'
      | 'removeVolume'
      | 'getOrCreateProjectNetwork'
      | 'connectContainerToNetwork'
    >
  >;
  let activity: jest.Mocked<Pick<ActivityService, 'log'>>;

  beforeEach(() => {
    jest.clearAllMocks();

    db = {
      resource: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'res-1',
          type: ResourceType.postgres,
          environmentId: 'env-1',
          environment: { projectId: 'project-1' },
          credentials: {},
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
      environment: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ project: { id: 'project-1', ownerId: 'owner-1' } }),
      },
    };
    docker = {
      createVolume: jest.fn().mockResolvedValue({ Name: 'resource-res-1-data' }),
      pullImage: jest.fn().mockResolvedValue(undefined),
      createContainer: jest.fn().mockResolvedValue({ id: 'container-1' }),
      startContainer: jest.fn().mockResolvedValue(undefined),
      checkContainerHealth: jest.fn().mockResolvedValue(true),
      stopContainer: jest.fn().mockResolvedValue(undefined),
      removeContainer: jest.fn().mockResolvedValue(undefined),
      removeVolume: jest.fn().mockResolvedValue(undefined),
      getOrCreateProjectNetwork: jest.fn().mockResolvedValue({ id: 'network-1' }),
      connectContainerToNetwork: jest.fn().mockResolvedValue(undefined),
    };
    activity = { log: jest.fn().mockResolvedValue(undefined) };

    processor = new ResourceProcessor(
      db as unknown as DbService,
      docker as unknown as DockerService,
      activity as unknown as ActivityService,
    );
  });

  it('provisions successfully and marks the resource ready', async () => {
    await processor.process(buildJob());

    expect(db.resource.update).toHaveBeenCalledWith({
      where: { id: 'res-1' },
      data: expect.objectContaining({ status: ResourceStatus.ready }),
    });
    expect(docker.removeVolume).not.toHaveBeenCalled();
    expect(docker.removeContainer).not.toHaveBeenCalled();
  });

  it('cleans up the volume it created when the image pull fails', async () => {
    docker.pullImage.mockRejectedValue(new Error('No such image'));

    await processor.process(buildJob());

    expect(docker.removeVolume).toHaveBeenCalledWith('resource-res-1-data');
    // no container was ever created at this point
    expect(docker.stopContainer).toHaveBeenCalledWith('resource-res-1');
    expect(docker.removeContainer).toHaveBeenCalledWith('resource-res-1');
    expect(db.resource.update).toHaveBeenCalledWith({
      where: { id: 'res-1' },
      data: { status: ResourceStatus.failed },
    });
  });

  it('cleans up the container and volume when the health check fails', async () => {
    docker.checkContainerHealth.mockResolvedValue(false);

    await processor.process(buildJob());

    expect(docker.stopContainer).toHaveBeenCalledWith('resource-res-1');
    expect(docker.removeContainer).toHaveBeenCalledWith('resource-res-1');
    expect(docker.removeVolume).toHaveBeenCalledWith('resource-res-1-data');
    expect(db.resource.update).toHaveBeenCalledWith({
      where: { id: 'res-1' },
      data: { status: ResourceStatus.failed },
    });
    // never reached the success update
    expect(db.resource.update).not.toHaveBeenCalledWith({
      where: { id: 'res-1' },
      data: expect.objectContaining({ status: ResourceStatus.ready }),
    });
  });

  it('does not fail the job when the failure-path cleanup itself errors', async () => {
    docker.pullImage.mockRejectedValue(new Error('No such image'));
    docker.removeVolume.mockRejectedValue(new Error('volume not found'));
    docker.stopContainer.mockRejectedValue(new Error('container not found'));

    await expect(processor.process(buildJob())).resolves.toBeUndefined();

    expect(db.resource.update).toHaveBeenCalledWith({
      where: { id: 'res-1' },
      data: { status: ResourceStatus.failed },
    });
  });
});
