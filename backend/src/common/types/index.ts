import type { Request } from 'express';
import type {
  Deployment,
  Project,
  Source,
  Environment,
  Resource,
  ActivityType,
} from '@generated/client';
import type { LogLevel } from '@generated/client';

export interface AuthenticatedRequest extends Request {
  user: { id: string };
}

export interface JwtPayload {
  sub: string;
}

export interface GitHubUser {
  id: number;
  login: string;
  email: string | null;
  avatar_url: string;
}

export interface GitHubTokenResponse {
  access_token: string;
}

export interface GitHubAccountResponse {
  account: {
    login: string;
    type: string;
  };
}

export interface GitHubRepositoryList {
  total_count: number;
  repositories: {
    id: number;
    full_name: string;
    name: string;
    private: boolean;
  }[];
}

export interface GitHubWebhookPayload {
  installation?: { id: number };
  repository?: { full_name: string };
  ref?: string;
  action?: string;
}

export interface CommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

export interface LogEntry {
  deploymentId: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
}

export interface DeploymentJobData {
  deploymentId: string;
}

export interface DeploymentContext {
  deployment: Deployment;
  project: Project & { source: Source | null };
  environment: Environment;
  workspace: string;
  imageTag: string;
  commitSha: string;
  commitMessage: string;
  containerId: string;
  networkId: string;
  domain: string;
  variables: Record<string, string>;
  resources: Resource[];
}

export enum DeploymentStepName {
  CloneRepository = 'Clone Repository',
  ResolveCommit = 'Resolve Commit',
  BuildImage = 'Build Image',
  ProvisionRuntime = 'Provision Runtime',
  CreateContainer = 'Create Container',
  StartContainer = 'Start Container',
  HealthCheck = 'Health Check',
  ConfigureProxy = 'Configure Proxy',
  ActivateDeployment = 'Activate Deployment',
  Cleanup = 'Cleanup',
}

export interface DeploymentStep {
  readonly name: DeploymentStepName;

  execute(ctx: DeploymentContext): Promise<void>;
}

export class DeploymentStepExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeploymentStepExecutionError';
  }
}

export interface ActivityLogFilter {
  actorId?: string;
  projectId?: string;
  environmentId?: string;
  domainId?: string;
  resourceId?: string;
  type?: ActivityType;
}
