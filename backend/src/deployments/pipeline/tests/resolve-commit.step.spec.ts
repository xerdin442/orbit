import { ResolveCommitStep } from '../resolve-commit.step';
import { CommandService } from '@src/infrastructure/command.service';
import { LogService } from '@src/infrastructure/log.service';
import { DeploymentContext } from '@src/common/types';
import { DeploymentStepExecutionError } from '@src/common/types';

const mockCtx = (): DeploymentContext =>
  ({
    deployment: { id: 'dep-1' },
    workspace: '/tmp/build',
    commitSha: '',
    commitMessage: '',
  }) as DeploymentContext;

describe('ResolveCommitStep', () => {
  let step: ResolveCommitStep;
  let command: jest.Mocked<
    Pick<CommandService, 'gitRevParse' | 'gitLog' | 'gitCheckout'>
  >;
  let log: jest.Mocked<Pick<LogService, 'append'>>;

  beforeEach(() => {
    command = {
      gitRevParse: jest.fn(),
      gitLog: jest.fn(),
      gitCheckout: jest.fn(),
    };
    log = { append: jest.fn() };
    step = new ResolveCommitStep(
      command as unknown as CommandService,
      log as unknown as LogService,
    );
  });

  it('sets commitSha and commitMessage', async () => {
    command.gitRevParse.mockResolvedValue({
      exitCode: 0,
      stdout: 'abc123\n',
      stderr: '',
    });
    command.gitLog.mockResolvedValue({
      exitCode: 0,
      stdout: 'abc123\nfeat: add login\n',
      stderr: '',
    });

    const ctx = mockCtx();
    await step.execute(ctx);

    expect(ctx.commitSha).toBe('abc123');
    expect(ctx.commitMessage).toBe('feat: add login');
  });

  it('falls back to sha for message when log fails', async () => {
    command.gitRevParse.mockResolvedValue({
      exitCode: 0,
      stdout: 'abc123\n',
      stderr: '',
    });
    command.gitLog.mockResolvedValue({ exitCode: 1, stdout: '', stderr: '' });

    const ctx = mockCtx();
    await step.execute(ctx);

    expect(ctx.commitMessage).toBe('abc123');
  });

  it('throws on rev-parse failure', async () => {
    command.gitRevParse.mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'fatal: not a git repo',
    });

    await expect(step.execute(mockCtx())).rejects.toThrow(
      DeploymentStepExecutionError,
    );
  });

  it('checks out a pre-known commit instead of resolving HEAD (redeploy, or rollback with a pruned image)', async () => {
    command.gitCheckout.mockResolvedValue({
      exitCode: 0,
      stdout: '',
      stderr: '',
    });

    const ctx = mockCtx();
    ctx.commitSha = 'old-sha-123';
    ctx.commitMessage = 'original commit message';

    await step.execute(ctx);

    expect(command.gitCheckout).toHaveBeenCalledWith(
      '/tmp/build',
      'old-sha-123',
    );
    expect(command.gitRevParse).not.toHaveBeenCalled();
    expect(command.gitLog).not.toHaveBeenCalled();
    // unchanged — same commit, same message
    expect(ctx.commitSha).toBe('old-sha-123');
    expect(ctx.commitMessage).toBe('original commit message');
  });

  it('throws when checking out a pre-known commit fails', async () => {
    command.gitCheckout.mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'fatal: reference is not a tree',
    });

    const ctx = mockCtx();
    ctx.commitSha = 'old-sha-123';

    await expect(step.execute(ctx)).rejects.toThrow(
      DeploymentStepExecutionError,
    );
  });
});
