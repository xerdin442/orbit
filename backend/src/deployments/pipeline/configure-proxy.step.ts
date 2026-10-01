import { CaddyService } from '@src/infrastructure/caddy.service';
import {
  DeploymentStep,
  DeploymentContext,
  DeploymentStepName,
} from '@src/common/types';

export class ConfigureProxyStep implements DeploymentStep {
  readonly name = DeploymentStepName.ConfigureProxy;

  constructor(private readonly caddy: CaddyService) {}

  async execute(ctx: DeploymentContext): Promise<void> {
    const suffix = ctx.project.id.slice(0, 8);
    ctx.domain = `${ctx.project.name}-${suffix}.orbit.app`;

    await this.caddy.addRoute(ctx.domain, ctx.containerId, 3000);
    await this.caddy.reload();
  }
}
