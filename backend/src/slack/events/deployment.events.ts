import type { Deployment, Project, Environment } from '@generated/client';
import type { BuildStatus } from '@generated/client';
import type { DeploymentJob } from '@src/common/types';

export class DeploymentStatusChangedEvent {
  constructor(
    public readonly deployment: Deployment,
    public readonly project: Project,
    public readonly environment: Environment,
    public readonly status: BuildStatus,
    public readonly slackMetadata?: DeploymentJob['slackMetadata'],
  ) {}
}

export class DeploymentCompletedEvent {
  constructor(
    public readonly deployment: Deployment,
    public readonly project: Project,
    public readonly environment: Environment,
    public readonly domain: string,
    public readonly slackMetadata?: DeploymentJob['slackMetadata'],
  ) {}
}

export class DeploymentTerminatedEvent {
  constructor(
    public readonly deployment: Deployment,
    public readonly project: Project,
    public readonly environment: Environment,
    public readonly slackMetadata?: DeploymentJob['slackMetadata'],
  ) {}
}
