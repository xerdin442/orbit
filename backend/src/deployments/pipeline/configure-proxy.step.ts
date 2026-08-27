import { DbService } from '@src/db/db.service';
import { CaddyService } from '@src/infrastructure/caddy.service';
import { LogService } from '@src/infrastructure/log.service';
import { ActivityService } from '@src/activity/activity.service';
import { Secrets } from '@src/common/secrets';
import { randomAlphanumeric } from '@src/common/util';
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
      ctx.domain = await this.generateUniqueHostname(ctx);

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

  private async generateUniqueHostname(
    ctx: DeploymentContext,
  ): Promise<string> {
    const isDefaultBranch =
      ctx.environment.branch === (ctx.project.source?.defaultBranch ?? 'main');

    const prefix = isDefaultBranch
      ? ctx.project.name
      : `${ctx.project.name}-${ctx.environment.name}`;

    const MAX_ATTEMPTS = 10;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const hostname = `${prefix}-${randomAlphanumeric(7)}.${Secrets.INGRESS_HOST}`;

      const clash = await this.db.domain.findFirst({
        where: { hostname },
        select: { id: true },
      });

      if (!clash) {
        return hostname;
      }
    }

    throw new DeploymentStepExecutionError(
      `Could not generate a unique hostname for "${prefix}" after ${MAX_ATTEMPTS} attempts`,
    );
  }
}
