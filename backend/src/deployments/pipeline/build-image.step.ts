import { join } from 'path';
import { CommandService } from '@src/infrastructure/command.service';
import { LogService } from '@src/infrastructure/log.service';
import { LogLevel } from '@generated/client';
import {
  DeploymentStep,
  DeploymentContext,
  DeploymentStepName,
  DeploymentStepExecutionError,
} from '@src/common/types';

function resolveSourcePath(workspace: string, buildDirectory?: string | null) {
  if (!buildDirectory) return workspace;

  const safeSegments = buildDirectory
    .split('/')
    .filter((segment) => segment !== '' && segment !== '.' && segment !== '..');

  return join(workspace, ...safeSegments);
}

export class BuildImageStep implements DeploymentStep {
  readonly name = DeploymentStepName.BuildImage;

  constructor(
    private readonly command: CommandService,
    private readonly log: LogService,
  ) {}

  async execute(ctx: DeploymentContext): Promise<void> {
    await this.log.append(
      ctx.deployment.id,
      LogLevel.INFO,
      'Building image...',
    );

    ctx.imageTag = `project-${ctx.project.id}:${ctx.commitSha}`;

    const sourcePath = resolveSourcePath(
      ctx.workspace,
      ctx.project.buildDirectory,
    );

    const result = await this.command.railpackBuild(
      sourcePath,
      ctx.imageTag,
      ctx.project.startCommand ?? undefined,
      ctx.variables,
      (data) => {
        void this.log.append(ctx.deployment.id, LogLevel.INFO, data.trimEnd());
      },
      (data) => {
        void this.log.append(ctx.deployment.id, LogLevel.WARN, data.trimEnd());
      },
    );

    if (result.exitCode !== 0) {
      throw new DeploymentStepExecutionError(
        `Image build failed: ${result.stderr}`,
      );
    }
  }
}
