import Docker from 'dockerode';
import { DockerService } from '@src/infrastructure/docker.service';
import { LogService } from '@src/infrastructure/log.service';
import { LogLevel } from '@generated/client';
import {
  DeploymentStep,
  DeploymentContext,
  DeploymentStepName,
} from '@src/common/types';

export class CreateContainerStep implements DeploymentStep {
  readonly name = DeploymentStepName.CreateContainer;

  constructor(
    private readonly docker: DockerService,
    private readonly log: LogService,
  ) {}

  async execute(ctx: DeploymentContext): Promise<void> {
    await this.log.append(
      ctx.deployment.id,
      LogLevel.INFO,
      'Creating container...',
    );

    const network = await this.docker.getOrCreateProjectNetwork(ctx.project.id);

    const options: Docker.ContainerCreateOptions = {
      name: `project-${ctx.project.id}-deployment-${ctx.deployment.id}`,
      Image: ctx.imageTag,
      Env: ctx.variables,
      HostConfig: {
        NetworkMode: network.id,
        RestartPolicy: { Name: 'unless-stopped' },
      },
      Labels: {
        project: ctx.project.id,
        environment: ctx.environment.id,
        deployment: ctx.deployment.id,
        'managed-by': 'orbit',
      },
    };

    const container = await this.docker.createContainer(options);
    ctx.containerId = container.id;
  }
}
