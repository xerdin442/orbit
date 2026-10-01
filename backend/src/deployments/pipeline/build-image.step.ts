import { CommandService } from '@src/infrastructure/command.service';
import { LogService } from '@src/infrastructure/log.service';
import { LogLevel } from '@generated/client';
import {
  DeploymentStep,
  DeploymentContext,
  DeploymentStepName,
  DeploymentStepExecutionError,
} from '@src/common/types';

export class BuildImageStep implements DeploymentStep {
  readonly name = DeploymentStepName.BuildImage;

  constructor(
    private readonly command: CommandService,
    private readonly log: LogService,
  ) {}

  async execute(ctx: DeploymentContext): Promise<void> {
    ctx.imageTag = `project-${ctx.project.id}:${ctx.commitSha}`;

    const result = await this.command.railpackBuild(
      ctx.workspace,
      ctx.imageTag,
      (data) => {
        void this.log.append(ctx.deployment.id, LogLevel.INFO, data.trimEnd());
      },
    );

    if (result.exitCode !== 0) {
      throw new DeploymentStepExecutionError(
        `Image build failed: ${result.stderr}`,
      );
    }
  }
}
