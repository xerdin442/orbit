import { DockerService } from '@src/infrastructure/docker.service';
import {
  DeploymentStep,
  DeploymentContext,
  DeploymentStepName,
} from '@src/common/types';

export class StartContainerStep implements DeploymentStep {
  readonly name = DeploymentStepName.StartContainer;

  constructor(private readonly docker: DockerService) {}

  async execute(ctx: DeploymentContext): Promise<void> {
    await this.docker.startContainer(ctx.containerId);
  }
}
