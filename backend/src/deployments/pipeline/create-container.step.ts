import Docker from 'dockerode';
import { DockerService } from '@src/infrastructure/docker.service';
import { LogService } from '@src/infrastructure/log.service';
import { LogLevel } from '@generated/client';
import {
  DeploymentStep,
  DeploymentContext,
  DeploymentStepName,
  DeploymentStepExecutionError,
} from '@src/common/types';

function resolveContainerCommand(startCommand: string | null) {
  const trimmed = startCommand?.trim();
  if (!trimmed) return undefined;

  let command = trimmed.replace(/^sh\s+-c\s+/, '');

  const first = command[0];
  const last = command[command.length - 1];
  if (
    command.length >= 2 &&
    (first === '"' || first === "'") &&
    first === last
  ) {
    command = command.slice(1, -1);
  }

  return command;
}

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

    if (!ctx.imageTag) {
      throw new DeploymentStepExecutionError(
        'No image tag available for container creation',
      );
    }

    const network = await this.docker.getOrCreateProjectNetwork(ctx.project.id);
    const command = resolveContainerCommand(ctx.project.startCommand);

    const options: Docker.ContainerCreateOptions = {
      name: `project-${ctx.project.id}-deployment-${ctx.deployment.id}`,
      Image: ctx.imageTag,
      Env: ctx.variables,
      ...(command ? { Entrypoint: ['sh', '-c'], Cmd: [command] } : {}),
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
