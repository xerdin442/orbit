import { access } from 'fs/promises';
import { join } from 'path';
import { BuildImageStep } from '../build-image.step';
import { CommandService } from '@src/infrastructure/command.service';
import { LogService } from '@src/infrastructure/log.service';
import { DeploymentContext } from '@src/common/types';
import { DeploymentStepExecutionError } from '@src/common/types';
import { LogLevel } from '@generated/client';

jest.mock('fs/promises', () => ({
  access: jest.fn(),
}));

const mockAccess = access as jest.MockedFunction<typeof access>;

const mockCtx = (overrides?: {
  project?: Record<string, unknown>;
  variables?: string[];
}) =>
  ({
    deployment: { id: 'dep-1' },
    project: { id: 'proj-1', name: 'project', ...overrides?.project },
    workspace: '/tmp/build',
    commitSha: 'abc123',
    imageTag: null,
    variables: overrides?.variables ?? [],
  }) as unknown as DeploymentContext;

describe('BuildImageStep', () => {
  let step: BuildImageStep;
  let command: jest.Mocked<Pick<CommandService, 'railpackBuild' | 'dockerBuild'>>;
  let log: jest.Mocked<Pick<LogService, 'append'>>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no Dockerfile present, so the railpack path is taken.
    mockAccess.mockRejectedValue(new Error('ENOENT'));
    command = { railpackBuild: jest.fn(), dockerBuild: jest.fn() };
    log = { append: jest.fn() };
    step = new BuildImageStep(
      command as unknown as CommandService,
      log as unknown as LogService,
    );
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
      [],
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

    await step.execute(
      mockCtx({ project: { buildDirectory: '../../apps/web' } }),
    );

    expect(command.railpackBuild).toHaveBeenCalledWith(
      join('/tmp/build', 'apps', 'web'),
      'project-proj-1:abc123',
      undefined,
      [],
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

    await step.execute(
      mockCtx({ project: { startCommand: 'npm run start:prod' } }),
    );

    expect(command.railpackBuild).toHaveBeenCalledWith(
      '/tmp/build',
      'project-proj-1:abc123',
      'npm run start:prod',
      [],
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('passes ctx.variables through to railpackBuild as build-time env vars', async () => {
    command.railpackBuild.mockResolvedValue({
      exitCode: 0,
      stdout: '',
      stderr: '',
    });

    await step.execute(
      mockCtx({
        variables: ['NODE_ENV=production', 'API_URL=https://api.example.com'],
      }),
    );

    expect(command.railpackBuild).toHaveBeenCalledWith(
      '/tmp/build',
      'project-proj-1:abc123',
      undefined,
      ['NODE_ENV=production', 'API_URL=https://api.example.com'],
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
      async (_source, _tag, _startCommand, _envVars, onStdout, onStderr) => {
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

  it('builds with Docker when a Dockerfile is present, skipping railpack', async () => {
    mockAccess.mockResolvedValue(undefined);
    command.dockerBuild.mockResolvedValue({
      exitCode: 0,
      stdout: '',
      stderr: '',
    });

    const ctx = mockCtx({
      variables: ['NODE_ENV=production'],
    });
    await step.execute(ctx);

    expect(mockAccess).toHaveBeenCalledWith(join('/tmp/build', 'Dockerfile'));
    expect(ctx.imageTag).toBe('project-proj-1:abc123');
    expect(command.railpackBuild).not.toHaveBeenCalled();
    expect(command.dockerBuild).toHaveBeenCalledWith(
      '/tmp/build',
      join('/tmp/build', 'Dockerfile'),
      'project-proj-1:abc123',
      ['NODE_ENV=production'],
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('looks for the Dockerfile inside buildDirectory', async () => {
    mockAccess.mockResolvedValue(undefined);
    command.dockerBuild.mockResolvedValue({
      exitCode: 0,
      stdout: '',
      stderr: '',
    });

    await step.execute(mockCtx({ project: { buildDirectory: 'services/api' } }));

    expect(mockAccess).toHaveBeenCalledWith(
      join('/tmp/build', 'services', 'api', 'Dockerfile'),
    );
    expect(command.dockerBuild).toHaveBeenCalledWith(
      join('/tmp/build', 'services', 'api'),
      join('/tmp/build', 'services', 'api', 'Dockerfile'),
      'project-proj-1:abc123',
      [],
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('throws on Docker build failure', async () => {
    mockAccess.mockResolvedValue(undefined);
    command.dockerBuild.mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'dockerfile parse error',
    });

    await expect(step.execute(mockCtx())).rejects.toThrow(
      DeploymentStepExecutionError,
    );
  });

  it('logs Docker build output on both streams as INFO', async () => {
    mockAccess.mockResolvedValue(undefined);
    command.dockerBuild.mockImplementation(
      async (_ctx, _dockerfile, _tag, _args, onStdout, onStderr) => {
        onStdout?.('Step 1/5 : FROM node:20\n');
        onStderr?.('#5 building layer\n');
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    );

    await step.execute(mockCtx());

    expect(log.append).toHaveBeenCalledWith(
      'dep-1',
      LogLevel.INFO,
      'Step 1/5 : FROM node:20',
    );
    expect(log.append).toHaveBeenCalledWith(
      'dep-1',
      LogLevel.INFO,
      '#5 building layer',
    );
  });
});
