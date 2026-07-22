import { DockerService } from '@src/infrastructure/docker.service';
import { LogService } from '@src/infrastructure/log.service';
import { LogLevel } from '@generated/client';
import {
  DeploymentStep,
  DeploymentContext,
  DeploymentStepName,
} from '@src/common/types';

export class StartContainerStep implements DeploymentStep {
  readonly name = DeploymentStepName.StartContainer;

  constructor(
    private readonly docker: DockerService,
    private readonly log: LogService,
  ) {}

  async execute(ctx: DeploymentContext): Promise<void> {
    await this.log.append(
      ctx.deployment.id,
      LogLevel.INFO,
      'Starting container...',
    );

    await this.docker.startContainer(ctx.containerId);
  }
}
