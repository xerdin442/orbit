import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { CommandService } from '@src/infrastructure/command.service';
import { LogService } from '@src/infrastructure/log.service';
import { GitHubService } from '@src/github/github.service';
import { LogLevel } from '@generated/client';
import type { Source } from '@generated/client';
import {
  DeploymentStep,
  DeploymentContext,
  DeploymentStepName,
  DeploymentStepExecutionError,
} from '@src/common/types';

export class CloneRepositoryStep implements DeploymentStep {
  readonly name = DeploymentStepName.CloneRepository;

  constructor(
    private readonly command: CommandService,
    private readonly log: LogService,
    private readonly github: GitHubService,
  ) {}

  async execute(ctx: DeploymentContext): Promise<void> {
    const prefix = join(tmpdir(), 'builds-');
    ctx.workspace = await mkdtemp(prefix);

    const source = ctx.project.source!;
    const repoUrl = await this.resolveAuthenticatedUrl(source);

    const result = await this.command.gitClone(
      repoUrl,
      ctx.environment.branch,
      ctx.workspace,
      (data) => {
        void this.log.append(ctx.deployment.id, LogLevel.INFO, data.trimEnd());
      },
      (data) => {
        void this.log.append(ctx.deployment.id, LogLevel.WARN, data.trimEnd());
      },
    );

    if (result.exitCode !== 0) {
      await rm(ctx.workspace, { recursive: true, force: true });
      throw new DeploymentStepExecutionError(
        `Git clone failed: ${result.stderr}`,
      );
    }

    await this.log.append(
      ctx.deployment.id,
      LogLevel.INFO,
      'Git clone successful.',
    );
  }

  private async resolveAuthenticatedUrl(source: Source): Promise<string> {
    if (!source.installationId) {
      return source.repositoryUrl;
    }

    const token = await this.github.getInstallationToken(source.installationId);

    const url = new URL(source.repositoryUrl);
    url.username = 'x-access-token';
    url.password = token;
    return url.toString();
  }
}
