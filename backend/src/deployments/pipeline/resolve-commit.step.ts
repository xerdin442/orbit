import { CommandService } from '@src/infrastructure/command.service';
import { LogService } from '@src/infrastructure/log.service';
import { LogLevel } from '@generated/client';
import {
  DeploymentStep,
  DeploymentContext,
  DeploymentStepName,
  DeploymentStepExecutionError,
} from '@src/common/types';

export class ResolveCommitStep implements DeploymentStep {
  readonly name = DeploymentStepName.ResolveCommit;

  constructor(
    private readonly command: CommandService,
    private readonly log: LogService,
  ) {}

  async execute(ctx: DeploymentContext): Promise<void> {
    await this.log.append(
      ctx.deployment.id,
      LogLevel.INFO,
      'Resolving commit...',
    );

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
