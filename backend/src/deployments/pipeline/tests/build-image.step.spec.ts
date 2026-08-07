import { BuildImageStep } from '../build-image.step';
import { CommandService } from '@src/infrastructure/command.service';
import { LogService } from '@src/infrastructure/log.service';
import { DeploymentContext } from '@src/common/types';
import { DeploymentStepExecutionError } from '@src/common/types';
import { LogLevel } from '@generated/client';

const mockCtx = (): DeploymentContext =>
  ({
    deployment: { id: 'dep-1' },
    project: { id: 'proj-1' },
    workspace: '/tmp/build',
    commitSha: 'abc123',
    imageTag: null,
  }) as DeploymentContext;

describe('BuildImageStep', () => {
  let step: BuildImageStep;
  let command: jest.Mocked<Pick<CommandService, 'railpackBuild'>>;
  let log: jest.Mocked<Pick<LogService, 'append'>>;

  beforeEach(() => {
    command = { railpackBuild: jest.fn() };
    log = { append: jest.fn() };
    step = new BuildImageStep(command as CommandService, log as LogService);
  });

  it('sets imageTag and calls railpackBuild', async () => {
    command.railpackBuild.mockResolvedValue({
      exitCode: 0,
      stdout: '',
      stderr: '',
    });

    const ctx = mockCtx();
    await step.execute(ctx);

    expect(ctx.imageTag).toBe('project-proj-1:abc123');
    expect(command.railpackBuild).toHaveBeenCalledWith(
      '/tmp/build',
      'project-proj-1:abc123',
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('throws on build failure', async () => {
    command.railpackBuild.mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'build failed',
    });

    await expect(step.execute(mockCtx())).rejects.toThrow(
      DeploymentStepExecutionError,
    );
  });

  it('logs stdout as INFO and stderr as WARN', async () => {
    command.railpackBuild.mockImplementation(
      async (_source, _tag, onStdout, onStderr) => {
        onStdout?.('installing dependencies\n');
        onStderr?.('deprecated inflight@1.0.6\n');
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    );

    await step.execute(mockCtx());

    expect(log.append).toHaveBeenCalledWith(
      'dep-1',
      LogLevel.INFO,
      'installing dependencies',
    );
    expect(log.append).toHaveBeenCalledWith(
      'dep-1',
      LogLevel.WARN,
      'deprecated inflight@1.0.6',
    );
  });
});
