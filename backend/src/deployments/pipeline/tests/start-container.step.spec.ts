import { StartContainerStep } from '../start-container.step';
import { DockerService } from '@src/infrastructure/docker.service';
import { LogService } from '@src/infrastructure/log.service';
import {
  DeploymentContext,
  DeploymentStepExecutionError,
} from '@src/common/types';
import { LogLevel } from '@generated/client';

const mockCtx = (): DeploymentContext =>
  ({
    deployment: { id: 'dep-1' },
    containerId: 'container-1',
  }) as DeploymentContext;

describe('StartContainerStep', () => {
  let step: StartContainerStep;
  let docker: jest.Mocked<
    Pick<
      DockerService,
      'startContainer' | 'checkContainerHealth' | 'getContainerLogs'
    >
  >;
  let log: jest.Mocked<Pick<LogService, 'append'>>;

  beforeEach(() => {
    docker = {
      startContainer: jest.fn(),
      checkContainerHealth: jest.fn().mockResolvedValue(true),
      getContainerLogs: jest.fn(),
    };
    log = { append: jest.fn() };
    step = new StartContainerStep(
      docker as unknown as DockerService,
      log as unknown as LogService,
    );
  });

  it('starts the container from context', async () => {
    await step.execute(mockCtx());
    expect(docker.startContainer).toHaveBeenCalledWith('container-1');
    expect(docker.checkContainerHealth).toHaveBeenCalledWith(
      'container-1',
      60_000,
      5000,
    );
    expect(docker.getContainerLogs).not.toHaveBeenCalled();
  });

  it('logs recent container output and fails when the container is unhealthy', async () => {
    docker.checkContainerHealth.mockResolvedValue(false);
    docker.getContainerLogs.mockResolvedValue('listen tcp :3000: bind failed');

    await expect(step.execute(mockCtx())).rejects.toThrow(
      DeploymentStepExecutionError,
    );

    expect(docker.startContainer).toHaveBeenCalledWith('container-1');
    expect(docker.getContainerLogs).toHaveBeenCalledWith('container-1');
    expect(log.append).toHaveBeenCalledWith(
      'dep-1',
      LogLevel.WARN,
      'Container failed health check. Recent logs:\nlisten tcp :3000: bind failed\n',
    );
  });
});
