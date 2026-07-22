import { DockerService } from '@src/infrastructure/docker.service';
import { DbService } from '@src/db/db.service';
import { LogService } from '@src/infrastructure/log.service';
import { LogLevel } from '@generated/client';
import {
  DeploymentStep,
  DeploymentContext,
  DeploymentStepName,
} from '@src/common/types';

export class ProvisionRuntimeStep implements DeploymentStep {
  readonly name = DeploymentStepName.ProvisionRuntime;

  constructor(
    private readonly docker: DockerService,
    private readonly db: DbService,
    private readonly log: LogService,
  ) {}

  async execute(ctx: DeploymentContext): Promise<void> {
    await this.log.append(
      ctx.deployment.id,
      LogLevel.INFO,
      'Provisioning runtime...',
    );

    const network = await this.docker.getOrCreateProjectNetwork(ctx.project.id);
    ctx.networkId = network.id;

    const vars = await this.db.environmentVariable.findMany({
      where: { environmentId: ctx.environment.id },
    });

    for (const v of vars) {
      try {
        ctx.variables[v.key] = v.value;
      } catch {
        ctx.variables[v.key] = v.value;
      }
    }

    const resources = await this.db.resource.findMany({
      where: { environmentId: ctx.environment.id, status: 'ready' },
    });

    ctx.resources = resources;

    for (const r of resources) {
      const creds = r.credentials as Record<string, string> | null;
      if (creds) {
        for (const [key, value] of Object.entries(creds)) {
          ctx.variables[key] = value;
        }
      }
    }

    await this.log.append(
      ctx.deployment.id,
      LogLevel.INFO,
      `${Object.keys(ctx.variables).length} variables loaded`,
    );
  }
}
