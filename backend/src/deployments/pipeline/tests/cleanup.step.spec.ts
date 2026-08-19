import { CleanupStep } from '../cleanup.step';
import { DockerService } from '@src/infrastructure/docker.service';
import { DbService } from '@src/db/db.service';
import { DeploymentContext } from '@src/common/types';

const mockCtx = (): DeploymentContext =>
  ({
    deployment: { id: 'dep-2' },
    environment: { id: 'env-1' },
    workspace: '/tmp/build-123',
  }) as DeploymentContext;

describe('CleanupStep', () => {
  let step: CleanupStep;
  let docker: jest.Mocked<
    Pick<DockerService, 'stopContainer' | 'removeContainer'>
  >;
  let db: { deployment: { findMany: jest.Mock } };

  beforeEach(() => {
    docker = { stopContainer: jest.fn(), removeContainer: jest.fn() };
    db = { deployment: { findMany: jest.fn() } };

    step = new CleanupStep(
      docker as unknown as DockerService,
      db as unknown as DbService,
    );
  });

  it('stops and removes old containers', async () => {
    db.deployment.findMany.mockResolvedValue([
      { id: 'dep-1', containerId: 'c1' },
    ]);

    await step.execute(mockCtx());

    expect(docker.stopContainer).toHaveBeenCalledWith('c1');
    expect(docker.removeContainer).toHaveBeenCalledWith('c1');
  });

  it('swallows container cleanup errors', async () => {
    db.deployment.findMany.mockResolvedValue([
      { id: 'dep-1', containerId: 'c1' },
    ]);
    docker.stopContainer.mockRejectedValue(new Error('gone'));

    await expect(step.execute(mockCtx())).resolves.toBeUndefined();
  });

  it('skips deployments without containerId', async () => {
    db.deployment.findMany.mockResolvedValue([
      { id: 'dep-1', containerId: null },
    ]);

    await step.execute(mockCtx());

    expect(docker.stopContainer).not.toHaveBeenCalled();
  });
});
