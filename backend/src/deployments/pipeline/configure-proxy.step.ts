import { DbService } from '@src/db/db.service';
import { CaddyService } from '@src/infrastructure/caddy.service';
import { LogService } from '@src/infrastructure/log.service';
import { ActivityService } from '@src/activity/activity.service';
import { Secrets } from '@src/common/secrets';
import {
  ActivityType,
  Domain,
  DomainStatus,
  DomainType,
  LogLevel,
} from '@generated/client';
import {
  DeploymentStep,
  DeploymentContext,
  DeploymentStepName,
  DeploymentStepExecutionError,
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

    let newDomain: Domain | null = null;

    if (existing) {
      ctx.domain = existing.hostname;
    } else {
      const isDefaultBranch =
        ctx.environment.branch ===
        (ctx.project.source?.defaultBranch ?? 'main');

      ctx.domain = isDefaultBranch
        ? `${ctx.project.name}.${Secrets.INGRESS_HOST}`
        : `${ctx.project.name}-${ctx.environment.name}.${Secrets.INGRESS_HOST}`;

      newDomain = await this.db.domain.create({
        data: {
          hostname: ctx.domain,
          type: DomainType.managed,
          status: DomainStatus.active,
          environmentId: ctx.environment.id,
        },
      });
    }

    try {
      await this.caddy.syncEnvironment(ctx.environment.id);

      if (newDomain) {
        await this.activity.log(
          ActivityType.domain_added,
          ctx.project.ownerId,
          {
            domainId: newDomain.id,
            hostname: newDomain.hostname,
            environmentId: ctx.environment.id,
          },
        );
      }
    } catch (error) {
      if (newDomain) {
        await this.db.domain.delete({
          where: { id: newDomain.id },
        });
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new DeploymentStepExecutionError(
        `Failed to route traffic and configure proxy: ${message}`,
      );
    }
  }
}
