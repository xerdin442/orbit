import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
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

export class CloneRepositoryStep implements DeploymentStep {
  readonly name = DeploymentStepName.CloneRepository;

  constructor(
    private readonly command: CommandService,
    private readonly log: LogService,
  ) {}

  async execute(ctx: DeploymentContext): Promise<void> {
    const prefix = join(tmpdir(), 'builds-');
    ctx.workspace = await mkdtemp(prefix);

    const source = ctx.project.source!;

    const result = await this.command.gitClone(
      source.repositoryUrl,
      ctx.environment.branch,
      ctx.workspace,
      (data) => {
        void this.log.append(ctx.deployment.id, LogLevel.INFO, data.trimEnd());
      },
    );

    if (result.exitCode !== 0) {
      await rm(ctx.workspace, { recursive: true, force: true });
      throw new DeploymentStepExecutionError(
        `Git clone failed: ${result.stderr}`,
      );
    }
  }
}
