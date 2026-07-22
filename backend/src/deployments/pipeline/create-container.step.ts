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

    const name = `project-${ctx.project.id}-deployment-${ctx.deployment.id}`;

    const envVars: string[] = [];
    for (const [key, value] of Object.entries(ctx.variables)) {
      envVars.push(`${key}=${value}`);
    }

    const options: Docker.ContainerCreateOptions = {
      name,
      Image: ctx.imageTag,
      Env: envVars,
      HostConfig: {
        NetworkMode: ctx.networkId,
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
