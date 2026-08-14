export interface VercelProjectLink {
  type?: string;
  org?: string;
  repo?: string;
  productionBranch?: string;
}

export interface VercelProjectSummaryResponse {
  id: string;
  name: string;
  link?: VercelProjectLink;
}

export interface VercelProjectListResponse {
  projects: VercelProjectSummaryResponse[];
  pagination?: { next: number | null };
}

export interface VercelProjectDetailResponse extends VercelProjectSummaryResponse {
  rootDirectory?: string | null;
  alias?: (string | { domain: string })[];
}

export interface VercelEnvVar {
  key: string;
  value: string;
  target: string[];
}

export interface VercelEnvListResponse {
  envs: VercelEnvVar[];
}

export interface RailwayGraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

export interface RailwayDeploymentTrigger {
  serviceId: string;
  branch: string;
  repository: string;
}

export interface RailwayEnvironmentNode {
  id: string;
  name: string;
  isEphemeral: boolean;
  deploymentTriggers: { edges: { node: RailwayDeploymentTrigger }[] };
}

export interface RailwayServiceNode {
  id: string;
  name: string;
}

export interface RailwayProjectDetail {
  id: string;
  name: string;
  primaryEnvironmentId: string;
  services: { edges: { node: RailwayServiceNode }[] };
  environments: { edges: { node: RailwayEnvironmentNode }[] };
}

export interface RailwayProjectListResponse {
  projects: { edges: { node: { id: string; name: string } }[] };
}

export interface RailwayProjectDetailResponse {
  project: RailwayProjectDetail | null;
}

export interface RailwayVariablesResponse {
  variables: Record<string, string>;
}

export interface RailwayDomainsResponse {
  domains: { customDomains: { domain: string }[] };
}

export interface RailwayServiceInfo {
  serviceId: string;
  environmentId: string;
  name: string;
  repoFullName: string | null;
  branch: string | null;
}
