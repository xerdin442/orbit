import { CreateContainerStep } from '../create-container.step';
import { DockerService } from '@src/infrastructure/docker.service';
import { LogService } from '@src/infrastructure/log.service';
import { DeploymentContext } from '@src/common/types';

const mockCtx = (): DeploymentContext =>
  ({
    deployment: { id: 'dep-1' },
    project: { id: 'proj-1' },
    environment: { id: 'env-1' },
    containerId: '',
    imageTag: 'project-proj-1:abc123',
    variables: ['NODE_ENV=production', 'PORT=3000'],
  }) as DeploymentContext;

describe('CreateContainerStep', () => {
  let step: CreateContainerStep;
  let docker: jest.Mocked<
    Pick<DockerService, 'getOrCreateProjectNetwork' | 'createContainer'>
  >;
  let log: jest.Mocked<Pick<LogService, 'append'>>;

  beforeEach(() => {
    docker = {
      getOrCreateProjectNetwork: jest.fn().mockResolvedValue({ id: 'net-1' }),
      createContainer: jest.fn().mockResolvedValue({ id: 'container-1' }),
    };
    log = { append: jest.fn() };
    step = new CreateContainerStep(
      docker as unknown as DockerService,
      log as unknown as LogService,
    );
  });

  it('creates network and container with correct options', async () => {
    const ctx = mockCtx();
    await step.execute(ctx);

    expect(docker.getOrCreateProjectNetwork).toHaveBeenCalledWith('proj-1');
    expect(docker.createContainer).toHaveBeenCalled();

    const options: any = (docker.createContainer as jest.Mock).mock.calls[0][0];
    expect(options.Image).toBe('project-proj-1:abc123');
    expect(options.Env).toEqual(['NODE_ENV=production', 'PORT=3000']);
    expect(options.name).toBe('project-proj-1-deployment-dep-1');
    expect(options.Labels).toEqual({
      project: 'proj-1',
      environment: 'env-1',
      deployment: 'dep-1',
      'managed-by': 'orbit',
    });

    expect(ctx.containerId).toBe('container-1');
  });
});
