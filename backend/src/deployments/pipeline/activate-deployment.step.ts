import { DbService } from '@src/db/db.service';
import {
  DeploymentStep,
  DeploymentContext,
  DeploymentStepName,
} from '@src/common/types';
import { BuildStatus, LifecycleStatus } from '@generated/client';

export class ActivateDeploymentStep implements DeploymentStep {
  readonly name = DeploymentStepName.ActivateDeployment;

  constructor(private readonly db: DbService) {}

  async execute(ctx: DeploymentContext): Promise<void> {
    await this.db.$transaction(async (tx) => {
      await tx.deployment.updateMany({
        where: {
          environmentId: ctx.environment.id,
          lifecycleStatus: LifecycleStatus.active,
          id: { not: ctx.deployment.id },
        },
        data: { lifecycleStatus: LifecycleStatus.inactive },
      });

      await tx.deployment.update({
        where: { id: ctx.deployment.id },
        data: {
          buildStatus: BuildStatus.ready,
          lifecycleStatus: LifecycleStatus.active,
        },
      });

      await tx.environment.update({
        where: { id: ctx.environment.id },
        data: { currentDeploymentId: ctx.deployment.id },
      });
    });
  }
}
