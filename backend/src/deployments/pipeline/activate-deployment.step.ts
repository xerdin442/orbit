import { DbService } from '@src/db/db.service';
import {
  DeploymentStep,
  DeploymentContext,
  DeploymentStepName,
  DeploymentStepExecutionError,
} from '@src/common/types';
import { BuildStatus, LifecycleStatus } from '@generated/client';

export class ActivateDeploymentStep implements DeploymentStep {
  readonly name = DeploymentStepName.ActivateDeployment;

  constructor(private readonly db: DbService) {}

  async execute(ctx: DeploymentContext): Promise<void> {
    await this.db.$transaction(async (tx) => {
      // Promote this deployment first, and only if it hasn't been aborted meanwhile;
      // throwing rolls the transaction back so the previous deployment stays live.
      const { count } = await tx.deployment.updateMany({
        where: {
          id: ctx.deployment.id,
          buildStatus: { not: BuildStatus.aborted },
        },
        data: {
          buildStatus: BuildStatus.ready,
          lifecycleStatus: LifecycleStatus.active,
        },
      });

      if (count === 0) {
        throw new DeploymentStepExecutionError(
          'Deployment was aborted before it could be activated',
        );
      }

      await tx.deployment.updateMany({
        where: {
          environmentId: ctx.environment.id,
          lifecycleStatus: LifecycleStatus.active,
          id: { not: ctx.deployment.id },
        },
        data: { lifecycleStatus: LifecycleStatus.inactive },
      });

      await tx.environment.update({
        where: { id: ctx.environment.id },
        data: { currentDeploymentId: ctx.deployment.id },
      });
    });
  }
}
