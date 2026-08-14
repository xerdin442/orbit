export interface ExternalProjectSummary {
  id: string;
  name: string;
  groupLabel?: string;
  repoFullName: string | null;
}

export interface ExternalProjectDetail extends ExternalProjectSummary {
  defaultBranch: string | null;
  envVars: { key: string; value: string }[];
  domains: string[];
  buildDirectory?: string;
  startCommand?: string;
}

export interface MigrationProvider {
  validateToken(token: string): Promise<boolean>;
  listProjects(token: string): Promise<ExternalProjectSummary[]>;
  getProjectDetail(token: string, id: string): Promise<ExternalProjectDetail>;
}
