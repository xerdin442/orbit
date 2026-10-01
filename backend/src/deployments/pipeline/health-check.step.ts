import { DockerService } from '@src/infrastructure/docker.service';
import { LogService } from '@src/infrastructure/log.service';
import { LogLevel } from '@generated/client';
import {
  DeploymentStep,
  DeploymentContext,
  DeploymentStepName,
  DeploymentStepExecutionError,
} from '@src/common/types';

export class HealthCheckStep implements DeploymentStep {
  readonly name = DeploymentStepName.HealthCheck;

  constructor(
    private readonly docker: DockerService,
    private readonly log: LogService,
  ) {}

  async execute(ctx: DeploymentContext): Promise<void> {
    if (!ctx.project.healthCheck) return;

    await this.log.append(
      ctx.deployment.id,
      LogLevel.INFO,
      'Running health check...',
    );

    const container = await this.docker.inspectContainer(ctx.containerId);
    const ip =
      container.NetworkSettings.Networks[
        Object.keys(container.NetworkSettings.Networks)[0]
      ].IPAddress;

    const deadline = Date.now() + 60_000;

    while (Date.now() < deadline) {
      try {
        const response = await fetch(`http://${ip}:3000/health`);

        if (response.ok) {
          await this.log.append(
            ctx.deployment.id,
            LogLevel.INFO,
            'Health check successful.',
          );
          return;
        }

        if (response.status >= 400) {
          const body = await response.text();
          throw new DeploymentStepExecutionError(
            `Health check failed with status ${response.status}: ${body}`,
          );
        }
      } catch (error) {
        if (error instanceof DeploymentStepExecutionError) {
          throw error;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    await this.docker.stopContainer(ctx.containerId);
    await this.docker.removeContainer(ctx.containerId);
    throw new DeploymentStepExecutionError(
      'Health check timed out after 60 seconds',
    );
  }
}
