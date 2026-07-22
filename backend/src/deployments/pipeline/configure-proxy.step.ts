import { randomBytes } from 'crypto';
import { DbService } from '@src/db/db.service';
import { CaddyService } from '@src/infrastructure/caddy.service';
import {
  DeploymentStep,
  DeploymentContext,
  DeploymentStepName,
} from '@src/common/types';
import { DomainStatus } from '@generated/client';

export class ConfigureProxyStep implements DeploymentStep {
  readonly name = DeploymentStepName.ConfigureProxy;

  constructor(
    private readonly caddy: CaddyService,
    private readonly db: DbService,
  ) {}

  async execute(ctx: DeploymentContext): Promise<void> {
    const existing = await this.db.domain.findFirst({
      where: { environmentId: ctx.environment.id },
    });

    if (existing) {
      ctx.domain = existing.hostname;
    } else {
      const suffix = randomBytes(4).toString('hex');
      ctx.domain = `${ctx.project.name}-${suffix}.orbit.app`;

      await this.db.domain.create({
        data: {
          hostname: ctx.domain,
          status: DomainStatus.active,
          environmentId: ctx.environment.id,
        },
      });
    }

    await this.caddy.addRoute(ctx.domain, ctx.containerId, 3000);
  }
}
