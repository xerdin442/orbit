import { rm } from 'fs/promises';
import { DockerService } from '@src/infrastructure/docker.service';
import { DbService } from '@src/db/db.service';
import {
  DeploymentStep,
  DeploymentContext,
  DeploymentStepName,
} from '@src/common/types';

export class CleanupStep implements DeploymentStep {
  readonly name = DeploymentStepName.Cleanup;

  constructor(
    private readonly docker: DockerService,
    private readonly db: DbService,
  ) {}

  async execute(ctx: DeploymentContext): Promise<void> {
    const previousDeployments = await this.db.deployment.findMany({
      where: {
        environmentId: ctx.environment.id,
        lifecycleStatus: 'inactive',
        id: { not: ctx.deployment.id },
      },
    });

    for (const dep of previousDeployments) {
      if (dep.containerId) {
        try {
          await this.docker.stopContainer(dep.containerId);
          await this.docker.removeContainer(dep.containerId);
        } catch {
          // container already gone
        }
      }
    }

    if (ctx.workspace) {
      await rm(ctx.workspace, { recursive: true, force: true });
    }
  }
}
