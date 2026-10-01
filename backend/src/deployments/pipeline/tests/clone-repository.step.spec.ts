import { mkdtemp, rm } from 'fs/promises';
import { CloneRepositoryStep } from '../clone-repository.step';
import { CommandService } from '@src/infrastructure/command.service';
import { LogService } from '@src/infrastructure/log.service';
import { DeploymentContext } from '@src/common/types';
import { DeploymentStepExecutionError } from '@src/common/types';
import { LogLevel } from '@generated/client';

jest.mock('fs/promises', () => ({
  mkdtemp: jest.fn().mockResolvedValue('/tmp/builds-12345'),
  rm: jest.fn().mockResolvedValue(undefined),
}));

const WORKSPACE = '/tmp/builds-12345';

const mockCtx = (): DeploymentContext =>
  ({
    deployment: { id: 'dep-1' },
    project: {
      source: { repositoryUrl: 'https://github.com/owner/repo' },
    },
    environment: { branch: 'main' },
    workspace: '',
  }) as DeploymentContext;

describe('CloneRepositoryStep', () => {
  let step: CloneRepositoryStep;
  let command: jest.Mocked<Pick<CommandService, 'gitClone'>>;
  let log: jest.Mocked<Pick<LogService, 'append'>>;

  beforeEach(() => {
    jest.clearAllMocks();

    (mkdtemp as jest.Mock).mockResolvedValue(WORKSPACE);
    (rm as jest.Mock).mockResolvedValue(undefined);

    command = { gitClone: jest.fn() };
    log = { append: jest.fn() };
    step = new CloneRepositoryStep(
      command as unknown as CommandService,
      log as unknown as LogService,
    );
  });

  it('calls gitClone with workspace path and branch', async () => {
    command.gitClone.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

    await step.execute(mockCtx());

    expect(mkdtemp).toHaveBeenCalledWith(expect.stringContaining('builds-'));
    expect(command.gitClone).toHaveBeenCalledWith(
      'https://github.com/owner/repo',
      'main',
      WORKSPACE,
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('logs stdout as INFO and stderr as WARN', async () => {
    command.gitClone.mockImplementation(
      async (_url, _branch, _path, onStdout, onStderr) => {
        onStdout?.('cloning into workspace\n');
        onStderr?.('Receiving objects: 100% (42/42), done.\n');
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    );

    await step.execute(mockCtx());

    expect(log.append).toHaveBeenCalledWith(
      'dep-1',
      LogLevel.INFO,
      'cloning into workspace',
    );
    expect(log.append).toHaveBeenCalledWith(
      'dep-1',
      LogLevel.WARN,
      'Receiving objects: 100% (42/42), done.',
    );
  });

  it('throws on clone failure and removes the workspace', async () => {
    command.gitClone.mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'repository not found',
    });

    await expect(step.execute(mockCtx())).rejects.toThrow(
      new DeploymentStepExecutionError(
        'Git clone failed: repository not found',
      ),
    );

    expect(rm).toHaveBeenCalledWith(WORKSPACE, {
      recursive: true,
      force: true,
    });
  });
});
