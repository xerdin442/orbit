import { CloneRepositoryStep } from '../clone-repository.step';
import { CommandService } from '@src/infrastructure/command.service';
import { LogService } from '@src/infrastructure/log.service';
import { DeploymentContext } from '@src/common/types';
import { DeploymentStepExecutionError } from '@src/common/types';

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
    command = { gitClone: jest.fn() };
    log = { append: jest.fn() };
    step = new CloneRepositoryStep(
      command as CommandService,
      log as LogService,
    );
  });

  it('calls gitClone with workspace path and branch', async () => {
    command.gitClone.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

    await step.execute(mockCtx());

    expect(command.gitClone).toHaveBeenCalledWith(
      'https://github.com/owner/repo',
      'main',
      expect.stringContaining('builds-'),
      expect.any(Function),
    );
  });

  it('throws on clone failure', async () => {
    command.gitClone.mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'repository not found',
    });

    await expect(step.execute(mockCtx())).rejects.toThrow(
      DeploymentStepExecutionError,
    );
  });
});
