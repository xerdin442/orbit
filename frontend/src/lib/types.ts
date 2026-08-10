export interface UserSlackInstallation {
  teamId: string;
  teamName: string | null;
  installerSlackUserId: string;
  isActive: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  githubUserId: number;
  githubUsername: string;
  email: string | null;
  avatarUrl: string | null;
  createdAt: string;
  slackInstallation: UserSlackInstallation | null;
}

export interface Source {
  id: string;
  repositoryUrl: string;
  provider: string;
  defaultBranch: string;
  installationId: number | null;
}

export interface Project {
  id: string;
  name: string;
  ownerId: string;
  healthCheck: boolean;
  healthCheckPort: number;
  healthCheckPath: string;
  healthCheckTimeout: number;
  buildDirectory: string | null;
  startCommand: string | null;
  source: Source | null;
  createdAt: string;
  updatedAt: string;
}

export interface Environment {
  id: string;
  name: string;
  branch: string;
  autoDeploy: boolean;
  currentDeploymentId: string | null;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

export type DeploymentTrigger = "manual" | "webhook" | "rollback" | "redeploy";

export type BuildStatus =
  | "pending"
  | "cloning"
  | "building"
  | "deploying"
  | "ready"
  | "failed"
  | "aborted";

export type LifecycleStatus = "active" | "inactive" | "aborted";

export type LogLevel = "INFO" | "WARN" | "ERROR" | "SUCCESS";

export interface Deployment {
  id: string;
  commitSha: string;
  commitMessage: string | null;
  imageTag: string | null;
  containerId: string | null;
  trigger: DeploymentTrigger;
  buildStatus: BuildStatus;
  lifecycleStatus: LifecycleStatus;
  environmentId: string;
  createdAt: string;
  completedAt: string | null;
  updatedAt: string;
}

export interface DeploymentDetail extends Deployment {
  environment: Environment;
}

export interface DeploymentLog {
  id: string;
  deploymentId: string;
  timestamp: string;
  level: LogLevel;
  message: string;
}

export type ResourceType = "postgres" | "mysql" | "redis" | "mongo";

export type ResourceStatus = "provisioning" | "ready" | "unhealthy" | "failed";

export interface Resource {
  id: string;
  type: ResourceType;
  name: string;
  status: ResourceStatus;
  hostname: string | null;
  ports: Record<string, number> | null;
  credentials: Record<string, string> | null;
  containerId: string | null;
  volumeId: string | null;
  networkId: string | null;
  environmentId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceDefaultKey {
  key: string;
  description: string;
}

export type DomainType = "managed" | "custom";

export type DomainStatus = "pending" | "verifying" | "active" | "failed";

export interface Domain {
  id: string;
  hostname: string;
  type: DomainType;
  status: DomainStatus;
  verifiedAt: string | null;
  environmentId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DNSInstructions {
  recordType: "A" | "CNAME";
  host: string;
  value: string;
}

export type StatusClass = "2xx" | "3xx" | "4xx" | "5xx";

export const STATUS_CLASSES: StatusClass[] = ["2xx", "3xx", "4xx", "5xx"];

export interface RequestLog {
  id: string;
  environmentId: string;
  timestamp: string;
  method: string;
  uri: string;
  statusCode: number;
  durationMs: number;
  hostname: string;
}

export interface EnvironmentVariable {
  id: string;
  key: string;
  value: string;
  generated: boolean;
  environmentId: string;
  createdAt: string;
}

export interface GitHubInstallation {
  installationId: number;
  accountLogin: string;
  accountType: string;
}

export interface GitHubRepository {
  id: number;
  full_name: string;
  name: string;
  private: boolean;
}

export interface GitHubBranch {
  name: string;
}

export type ActivityType =
  | "user_signed_up"
  | "user_signed_in"
  | "project_created"
  | "project_updated"
  | "project_deleted"
  | "environment_created"
  | "environment_updated"
  | "environment_deleted"
  | "deployment_started"
  | "deployment_completed"
  | "deployment_failed"
  | "deployment_rolled_back"
  | "deployment_aborted"
  | "variable_created"
  | "variable_updated"
  | "variable_deleted"
  | "domain_added"
  | "domain_removed"
  | "domain_verified"
  | "github_installation_added"
  | "github_installation_removed"
  | "github_webhook_event"
  | "resource_provisioned"
  | "resource_deleted"
  | "resource_data_cleared"
  | "slack_installation_added"
  | "slack_installation_removed"
  | "slack_token_revoked";

export interface ActivityLog {
  id: string;
  type: ActivityType;
  actorId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface SchemaNode {
  name: string;
  type: "database" | "schema" | "table";
  children?: SchemaNode[];
}

export interface TableInfo {
  name: string;
  schema?: string;
}

export interface TableColumn {
  name: string;
  type: string;
}

export interface TableData {
  columns: TableColumn[];
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  limit: number;
}

export interface QueryResult {
  columns: TableColumn[];
  rows: Record<string, unknown>[];
}

export interface PaginatedMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginatedMeta;
}

export interface CreateProjectPayload {
  name: string;
  repositoryUrl: string;
  defaultBranch: string;
  healthCheck?: boolean;
  healthCheckPort?: number;
  healthCheckPath?: string;
  healthCheckTimeout?: number;
  installationId?: number;
  envVars?: Record<string, string>;
  buildDirectory?: string;
  startCommand?: string;
}

export interface CreateEnvironmentPayload {
  name: string;
  branch: string;
  autoDeploy: boolean;
}

export interface UpdateEnvironmentPayload {
  name?: string;
  branch?: string;
  autoDeploy?: boolean;
}

export interface CreateVariablePayload {
  key: string;
  value: string;
}

export interface UpdateVariablePayload {
  key?: string;
  value?: string;
}

export interface CreateResourcePayload {
  type: ResourceType;
  name: string;
  credentials?: Record<string, string>;
}

export interface AddDomainPayload {
  hostname: string;
}

export interface VariableEntry {
  key: string;
  value: string;
}
