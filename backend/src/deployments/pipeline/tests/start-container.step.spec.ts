import { StartContainerStep } from '../start-container.step';
import { DockerService } from '@src/infrastructure/docker.service';
import { LogService } from '@src/infrastructure/log.service';
import { DeploymentContext } from '@src/common/types';

const mockCtx = (): DeploymentContext =>
  ({
    deployment: { id: 'dep-1' },
    containerId: 'container-1',
  }) as DeploymentContext;

describe('StartContainerStep', () => {
  let step: StartContainerStep;
  let docker: jest.Mocked<Pick<DockerService, 'startContainer'>>;
  let log: jest.Mocked<Pick<LogService, 'append'>>;

  beforeEach(() => {
    docker = { startContainer: jest.fn() };
    log = { append: jest.fn() };
    step = new StartContainerStep(docker as DockerService, log as LogService);
  });

  it('starts the container from context', async () => {
    await step.execute(mockCtx());
    expect(docker.startContainer).toHaveBeenCalledWith('container-1');
  });
});
