import { CommandService } from '@src/infrastructure/command.service';
import {
  DeploymentStep,
  DeploymentContext,
  DeploymentStepName,
  DeploymentStepExecutionError,
} from '@src/common/types';

export class ResolveCommitStep implements DeploymentStep {
  readonly name = DeploymentStepName.ResolveCommit;

  constructor(private readonly command: CommandService) {}

  async execute(ctx: DeploymentContext): Promise<void> {
    const shaResult = await this.command.gitRevParse(ctx.workspace);

    if (shaResult.exitCode !== 0) {
      throw new DeploymentStepExecutionError(
        `Failed to resolve commit: ${shaResult.stderr}`,
      );
    }

    ctx.commitSha = shaResult.stdout.trim();

    const logResult = await this.command.gitLog(ctx.workspace);

    if (logResult.exitCode === 0) {
      const [sha, subject] = logResult.stdout.trim().split('\n');
      ctx.commitMessage = subject || sha;
    } else {
      ctx.commitMessage = ctx.commitSha;
    }
  }
}
