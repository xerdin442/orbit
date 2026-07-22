import { CommandService } from '@src/infrastructure/command.service';
import {
  DeploymentStep,
  DeploymentContext,
  DeploymentStepName,
  DeploymentStepExecutionError,
} from '@src/common/types';

export class BuildImageStep implements DeploymentStep {
  readonly name = DeploymentStepName.BuildImage;

  constructor(private readonly command: CommandService) {}

  async execute(ctx: DeploymentContext): Promise<void> {
    ctx.imageTag = `project-${ctx.project.id}:${ctx.commitSha}`;

    const result = await this.command.railpackBuild(
      ctx.workspace,
      ctx.imageTag,
    );

    if (result.exitCode !== 0) {
      throw new DeploymentStepExecutionError(
        `Image build failed: ${result.stderr}`,
      );
    }
  }
}
