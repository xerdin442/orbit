import { join } from 'path';
import { BuildImageStep } from '../build-image.step';
import { CommandService } from '@src/infrastructure/command.service';
import { LogService } from '@src/infrastructure/log.service';
import { DeploymentContext } from '@src/common/types';
import { DeploymentStepExecutionError } from '@src/common/types';
import { LogLevel } from '@generated/client';

const mockCtx = (overrides?: { project?: Record<string, unknown> }) =>
  ({
    deployment: { id: 'dep-1' },
    project: { id: 'proj-1', ...overrides?.project },
    workspace: '/tmp/build',
    commitSha: 'abc123',
    imageTag: null,
  }) as unknown as DeploymentContext;

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
      undefined,
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('resolves the source path from buildDirectory, stripping ".." segments', async () => {
    command.railpackBuild.mockResolvedValue({
      exitCode: 0,
      stdout: '',
      stderr: '',
    });

    await step.execute(mockCtx({ project: { buildDirectory: '../../apps/web' } }));

    expect(command.railpackBuild).toHaveBeenCalledWith(
      join('/tmp/build', 'apps', 'web'),
      'project-proj-1:abc123',
      undefined,
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('passes startCommand through to railpackBuild', async () => {
    command.railpackBuild.mockResolvedValue({
      exitCode: 0,
      stdout: '',
      stderr: '',
    });

    await step.execute(mockCtx({ project: { startCommand: 'npm run start:prod' } }));

    expect(command.railpackBuild).toHaveBeenCalledWith(
      '/tmp/build',
      'project-proj-1:abc123',
      'npm run start:prod',
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
      async (_source, _tag, _startCommand, onStdout, onStderr) => {
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
