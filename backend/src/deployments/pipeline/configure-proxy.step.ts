import { randomBytes } from 'crypto';
import { DbService } from '@src/db/db.service';
import { CaddyService } from '@src/infrastructure/caddy.service';
import { LogService } from '@src/infrastructure/log.service';
import { ActivityService } from '@src/activity/activity.service';
import { ActivityType, LogLevel, DomainStatus } from '@generated/client';
import {
  DeploymentStep,
  DeploymentContext,
  DeploymentStepName,
} from '@src/common/types';

export class ConfigureProxyStep implements DeploymentStep {
  readonly name = DeploymentStepName.ConfigureProxy;

  constructor(
    private readonly caddy: CaddyService,
    private readonly db: DbService,
    private readonly log: LogService,
    private readonly activity: ActivityService,
  ) {}

  async execute(ctx: DeploymentContext): Promise<void> {
    await this.log.append(
      ctx.deployment.id,
      LogLevel.INFO,
      'Routing traffic...',
    );

    const existing = await this.db.domain.findFirst({
      where: { environmentId: ctx.environment.id },
    });

    if (existing) {
      ctx.domain = existing.hostname;
    } else {
      const suffix = randomBytes(4).toString('hex');
      ctx.domain = `${ctx.project.name}-${suffix}.orbit.app`;

      const domain = await this.db.domain.create({
        data: {
          hostname: ctx.domain,
          status: DomainStatus.active,
          environmentId: ctx.environment.id,
        },
      });

      await this.activity.log(ActivityType.domain_added, ctx.project.ownerId, {
        domainId: domain.id,
        hostname: domain.hostname,
        environmentId: ctx.environment.id,
        projectId: ctx.environment.projectId,
      });
    }

    await this.caddy.addRoute(ctx.domain, ctx.containerId, 3000);
  }
}
