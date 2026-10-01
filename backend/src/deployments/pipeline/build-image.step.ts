import { access } from 'fs/promises';
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

    const imageTag = `${ctx.project.name}-${ctx.project.id}:${ctx.commitSha}`;
    ctx.imageTag = imageTag;

    const sourcePath = resolveSourcePath(
      ctx.workspace,
      ctx.project.buildDirectory,
    );

    const dockerfilePath = join(sourcePath, 'Dockerfile');
    const hasDockerfile = await access(dockerfilePath)
      .then(() => true)
      .catch(() => false);

    const result = hasDockerfile
      ? await this.buildWithDocker(ctx, imageTag, sourcePath, dockerfilePath)
      : await this.buildWithRailpack(ctx, imageTag, sourcePath);

    if (result.exitCode !== 0) {
      throw new DeploymentStepExecutionError(
        `Image build failed: ${result.stderr}`,
      );
    }
  }

  private async buildWithDocker(
    ctx: DeploymentContext,
    imageTag: string,
    sourcePath: string,
    dockerfilePath: string,
  ) {
    await this.log.append(
      ctx.deployment.id,
      LogLevel.INFO,
      'Dockerfile detected, building with Docker...',
    );

    return this.command.dockerBuild(
      sourcePath,
      dockerfilePath,
      imageTag,
      ctx.variables,
      (data) => {
        void this.log.append(ctx.deployment.id, LogLevel.INFO, data.trimEnd());
      },
      (data) => {
        void this.log.append(ctx.deployment.id, LogLevel.INFO, data.trimEnd());
      },
    );
  }

  private async buildWithRailpack(
    ctx: DeploymentContext,
    imageTag: string,
    sourcePath: string,
  ) {
    return this.command.railpackBuild(
      sourcePath,
      imageTag,
      ctx.project.startCommand ?? undefined,
      ctx.variables,
      (data) => {
        void this.log.append(ctx.deployment.id, LogLevel.INFO, data.trimEnd());
      },
      (data) => {
        void this.log.append(ctx.deployment.id, LogLevel.WARN, data.trimEnd());
      },
    );
  }
}
