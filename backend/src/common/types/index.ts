import type { Request } from 'express';
import type {
  Deployment,
  Project,
  Source,
  Environment,
  Prisma,
} from '@generated/client';
import type { LogLevel } from '@generated/client';

export interface AuthenticatedRequest extends Request {
  user: { id: string };
}

export interface JwtPayload {
  sub: string;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
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

export interface DeploymentJob {
  deployment: Deployment;
  skipImageBuild?: boolean;
  resourceCount?: number;
  slackMetadata?: {
    teamId: string;
    channelId: string;
    userId: string;
    messageTs: string;
    startedAt: string;
  };
}

export interface ResourceJob {
  resourceId: string;
}

export interface CleanupJob {
  projectId?: string;
  environmentId?: string;
  deploymentContainerIds: string[];
  resourceContainers: { containerId?: string; volumeId?: string }[];
  networkName?: string;
}

export interface SlackApiJob {
  teamId: string;
  method: string;
  args: Record<string, unknown>;
}

export interface DeploymentContext {
  deployment: Deployment;
  project: Project & { source: Source | null };
  environment: Environment;
  workspace: string;
  imageTag: string | null;
  commitSha: string;
  commitMessage: string;
  containerId: string;
  domain: string;
  variables: string[];
}

export enum DeploymentStepName {
  CloneRepository = 'Clone Repository',
  ResolveCommit = 'Resolve Commit',
  BuildImage = 'Build Image',
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
  actorId: string;
  projectId?: string;
  environmentId?: string;
  deploymentId?: string;
  domainId?: string;
  resourceId?: string;
  type?: string;
}

export interface ResourceDefaultKey {
  key: string;
  description: string;
}

export interface DnsInstructions {
  recordType: 'A' | 'CNAME';
  host: string;
  value: string;
}

export interface SlackInstallationData {
  userId: string;
  teamId: string;
  teamName?: string | null;
  enterpriseId?: string | null;
  botToken: string;
  botUserId?: string | null;
  botId?: string | null;
  appId?: string | null;
  scopes: string[];
  installerSlackUserId: string;
  isEnterpriseInstall: boolean;
  raw?: Prisma.InputJsonValue;
}
