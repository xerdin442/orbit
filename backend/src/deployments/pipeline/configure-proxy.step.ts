import { DbService } from '@src/db/db.service';
import { CaddyService } from '@src/infrastructure/caddy.service';
import { LogService } from '@src/infrastructure/log.service';
import { ActivityService } from '@src/activity/activity.service';
import { Secrets } from '@src/common/secrets';
import {
  ActivityType,
  DomainStatus,
  DomainType,
  LogLevel,
} from '@generated/client';
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
      where: { environmentId: ctx.environment.id, type: DomainType.managed },
    });

    if (existing) {
      ctx.domain = existing.hostname;
    } else {
      const isDefaultBranch =
        ctx.environment.branch ===
        (ctx.project.source?.defaultBranch ?? 'main');

      ctx.domain = isDefaultBranch
        ? `${ctx.project.name}.${Secrets.INGRESS_HOST}`
        : `${ctx.project.name}-${ctx.environment.name}.${Secrets.INGRESS_HOST}`;

      const domain = await this.db.domain.create({
        data: {
          hostname: ctx.domain,
          type: DomainType.managed,
          status: DomainStatus.active,
          environmentId: ctx.environment.id,
        },
      });

      await this.activity.log(ActivityType.domain_added, ctx.project.ownerId, {
        domainId: domain.id,
        hostname: domain.hostname,
        environmentId: ctx.environment.id,
      });
    }

    await this.caddy.addRoute(ctx.domain, ctx.containerId, 3000);
  }
}
