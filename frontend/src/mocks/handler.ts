import { user } from "./auth";
import { projects } from "./projects";
import { environments } from "./environments";
import { deployments, deploymentsByEnv } from "./deployments";
import { logsByDeployment } from "./deployment-logs";
import { resourcesByEnv } from "./resources";
import {
  tablesByResource,
  schemaByResource,
  tableDataByResource,
} from "./workbench";
import { variablesByEnv } from "./environment-variables";
import { domainsByEnv } from "./domains";
import { requestLogsByEnv } from "./request-logs";
import { activityLogs } from "./activity";
import { RESOURCE_DEFAULTS } from "./resource-defaults";
import {
  githubInstallations,
  githubRepositories,
  githubBranches,
} from "./github";
import {
  externalProjectSummaries,
  externalProjectDetails,
} from "./migrations";
import type {
  Project,
  Environment,
  Deployment,
  Resource,
  ResourceType,
  EnvironmentVariable,
  Domain,
  ExternalProvider,
} from "@/lib/types";

type QueryParams = Record<string, string>;
type MockHandler = (
  params: Record<string, string>,
  query?: QueryParams,
  body?: unknown,
) => unknown;

function findResourceById(id: string): Resource | undefined {
  for (const list of Object.values(resourcesByEnv)) {
    const resource = list.find((r) => r.id === id);
    if (resource) return resource;
  }
  return undefined;
}

function findDomainById(id: string): Domain | undefined {
  for (const list of Object.values(domainsByEnv)) {
    const domain = list.find((d) => d.id === id);
    if (domain) return domain;
  }
  return undefined;
}

function computeDnsInstructions(hostname: string) {
  const parts = hostname.split(".");
  const isApex = parts.length <= 2;

  return isApex
    ? { recordType: "A", host: "@", value: "192.168.1.55" }
    : { recordType: "CNAME", host: parts[0], value: "ingress.orbit.dev" };
}

const mockRoutes: Record<string, MockHandler> = {
  "GET /auth/me": () => user,

  "GET /projects": () => projects,
  "GET /projects/:id": (params) => {
    const p = projects.find((p) => p.id === params.id);
    if (!p) throw new Error("Not found");
    return p;
  },

  "PATCH /projects/:id": (params, _query, body) => {
    const p = projects.find((p) => p.id === params.id);
    if (!p) throw new Error("Not found");

    const update = (body ?? {}) as Partial<{
      name: string;
      healthCheck: boolean;
      healthCheckPort: number;
      healthCheckPath: string;
      healthCheckTimeout: number;
      buildDirectory: string;
      startCommand: string;
    }>;

    Object.assign(p, update, { updatedAt: new Date().toISOString() });
    return p;
  },

  "POST /projects/:id/tokens/rotate": (params) => {
    const p = projects.find((p) => p.id === params.id);
    if (!p) throw new Error("Not found");

    p.secretAccessToken = `orbit_sat_${crypto.randomUUID().replace(/-/g, "")}`;
    p.updatedAt = new Date().toISOString();
    return p;
  },

  "DELETE /projects/:id": (params) => {
    const index = projects.findIndex((p) => p.id === params.id);
    if (index === -1) throw new Error("Not found");
    projects.splice(index, 1);
    delete environments[params.id];
  },

  "POST /projects": (_params, _query, body) => {
    const dto = (body ?? {}) as {
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
    };

    const projectId = `proj-${Date.now()}`;
    const environmentId = `env-${Date.now()}`;
    const now = new Date().toISOString();

    const project: Project = {
      id: projectId,
      name: dto.name,
      ownerId: "mock-user-1",
      healthCheck: dto.healthCheck ?? false,
      healthCheckPort: dto.healthCheckPort ?? 3000,
      healthCheckPath: dto.healthCheckPath ?? "/health",
      healthCheckTimeout: dto.healthCheckTimeout ?? 60,
      buildDirectory: dto.buildDirectory ?? null,
      startCommand: dto.startCommand ?? null,
      secretAccessToken: `orbit_sat_${crypto.randomUUID().replace(/-/g, "")}`,
      source: {
        id: `src-${Date.now()}`,
        repositoryUrl: dto.repositoryUrl,
        provider: "github",
        defaultBranch: dto.defaultBranch,
        installationId: dto.installationId ?? null,
      },
      createdAt: now,
      updatedAt: now,
    };

    const environment: Environment = {
      id: environmentId,
      name: "production",
      branch: dto.defaultBranch,
      autoDeploy: true,
      currentDeploymentId: null,
      projectId,
      createdAt: now,
      updatedAt: now,
    };

    projects.push(project);
    environments[projectId] = [environment];

    return { project, environmentId };
  },

  "GET /projects/:id/branches": (params) => {
    const p = projects.find((p) => p.id === params.id);
    if (!p?.source?.repositoryUrl) return [];
    const repoName = p.source.repositoryUrl.replace("https://github.com/", "");
    return githubBranches[repoName] ?? [{ name: p.source.defaultBranch }];
  },

  "GET /projects/:projectId/environments": (params) => {
    const envs = environments[params.projectId];
    if (!envs) throw new Error("Not found");
    return envs;
  },

  "GET /projects/:projectId/environments/:id": (params) => {
    const env = (environments[params.projectId] ?? []).find(
      (e) => e.id === params.id,
    );
    if (!env) throw new Error("Not found");
    return env;
  },

  "POST /projects/:projectId/environments": (params, _query, body) => {
    const dto = (body ?? {}) as {
      name: string;
      branch: string;
      autoDeploy: boolean;
    };
    const existing = environments[params.projectId] ?? [];

    if (existing.some((e) => e.branch === dto.branch)) {
      throw new Error("This branch is already connected to an environment");
    }

    const now = new Date().toISOString();
    const environment: Environment = {
      id: `env-${Date.now()}`,
      name: dto.name,
      branch: dto.branch,
      autoDeploy: dto.autoDeploy,
      currentDeploymentId: null,
      projectId: params.projectId,
      createdAt: now,
      updatedAt: now,
    };

    if (!environments[params.projectId]) {
      environments[params.projectId] = [];
    }
    environments[params.projectId].push(environment);

    return environment;
  },

  "DELETE /projects/:projectId/environments/:id": (params) => {
    const envs = environments[params.projectId] ?? [];
    const index = envs.findIndex((e) => e.id === params.id);
    if (index === -1) throw new Error("Not found");
    envs.splice(index, 1);
  },

  "PATCH /projects/:projectId/environments/:id": (params, _query, body) => {
    const env = (environments[params.projectId] ?? []).find(
      (e) => e.id === params.id,
    );
    if (!env) throw new Error("Not found");

    const update = (body ?? {}) as Partial<{
      name: string;
      branch: string;
      autoDeploy: boolean;
    }>;

    if (update.branch && update.branch !== env.branch) {
      const conflict = (environments[params.projectId] ?? []).some(
        (e) => e.id !== env.id && e.branch === update.branch,
      );
      if (conflict) {
        throw new Error("This branch is already connected to an environment");
      }
    }

    Object.assign(env, update, { updatedAt: new Date().toISOString() });
    return env;
  },

  "GET /projects/:projectId/environments/:id/variables": (params) => {
    return variablesByEnv[params.id] ?? [];
  },

  "POST /projects/:projectId/environments/:id/variables": (
    params,
    _query,
    body,
  ) => {
    const dto = (body ?? {}) as { key: string; value: string };
    const existing = variablesByEnv[params.id] ?? [];

    if (existing.some((v) => v.key === dto.key)) {
      throw new Error(
        `A variable named "${dto.key}" already exists in this environment`,
      );
    }

    const variable: EnvironmentVariable = {
      id: `var-${Date.now()}`,
      key: dto.key,
      value: dto.value,
      generated: false,
      environmentId: params.id,
      createdAt: new Date().toISOString(),
    };

    if (!variablesByEnv[params.id]) {
      variablesByEnv[params.id] = [];
    }
    variablesByEnv[params.id].push(variable);

    return variable;
  },

  "POST /projects/:projectId/environments/:id/variables/bulk": (
    params,
    _query,
    body,
  ) => {
    const dto = (body ?? {}) as { variables: { key: string; value: string }[] };
    const existing = variablesByEnv[params.id] ?? [];
    const existingKeys = new Set(existing.map((v) => v.key));

    const duplicate = dto.variables.find((v) => existingKeys.has(v.key));
    if (duplicate) {
      throw new Error(
        `A variable named "${duplicate.key}" already exists in this environment`,
      );
    }

    const now = new Date().toISOString();
    const created: EnvironmentVariable[] = dto.variables.map((v, i) => ({
      id: `var-${Date.now()}-${i}`,
      key: v.key,
      value: v.value,
      generated: false,
      environmentId: params.id,
      createdAt: now,
    }));

    if (!variablesByEnv[params.id]) {
      variablesByEnv[params.id] = [];
    }
    variablesByEnv[params.id].push(...created);

    return created;
  },

  "PATCH /projects/:projectId/environments/variables/:id": (
    params,
    _query,
    body,
  ) => {
    const dto = (body ?? {}) as { key?: string; value?: string };

    for (const vars of Object.values(variablesByEnv)) {
      const variable = vars.find((v) => v.id === params.id);
      if (variable) {
        if (dto.key !== undefined && dto.key !== variable.key) {
          if (vars.some((v) => v.key === dto.key)) {
            throw new Error(
              `A variable named "${dto.key}" already exists in this environment`,
            );
          }
          variable.key = dto.key;
        }
        if (dto.value !== undefined) {
          variable.value = dto.value;
        }
        return variable;
      }
    }

    throw new Error("Not found");
  },

  "DELETE /projects/:projectId/environments/variables/:id": (params) => {
    for (const [envId, vars] of Object.entries(variablesByEnv)) {
      const index = vars.findIndex((v) => v.id === params.id);
      if (index !== -1) {
        variablesByEnv[envId].splice(index, 1);
        return;
      }
    }
    throw new Error("Not found");
  },

  "POST /environments/:environmentId/redeploy": (params) => {
    const envDeployments = deploymentsByEnv[params.environmentId] ?? [];
    if (envDeployments.length === 0) throw new Error("Not found");
    return { deploymentId: envDeployments[0].id, status: "pending" };
  },

  "POST /deployments/:id/rollback": (params) => {
    const deployment = deployments.find((d) => d.id === params.id);
    if (!deployment) throw new Error("Not found");
    return { deploymentId: deployment.id, status: "pending" };
  },

  "GET /deployments/:id": (params) => {
    const deployment = deployments.find((d) => d.id === params.id);
    if (!deployment) throw new Error("Not found");

    for (const envs of Object.values(environments)) {
      const environment = envs.find((e) => e.id === deployment.environmentId);
      if (environment) {
        return { ...deployment, environment };
      }
    }

    return deployment;
  },

  "GET /deployments/:id/logs": (params) => {
    return logsByDeployment[params.id] ?? [];
  },

  "GET /environments/:environmentId/deployments": (params, query) => {
    const envDeployments = deploymentsByEnv[params.environmentId] ?? [];
    const sorted = [...envDeployments].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const page = query?.page ? Number(query.page) : 1;
    const limit = query?.limit ? Number(query.limit) : 20;
    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const data = sorted.slice((page - 1) * limit, page * limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  },

  "GET /environments/:id/requests": (params, query) => {
    const envRequests = requestLogsByEnv[params.id] ?? [];
    let filtered = envRequests;

    if (query?.method) {
      filtered = filtered.filter((r) => r.method === query.method);
    }

    if (query?.path) {
      filtered = filtered.filter((r) => r.path.includes(query.path));
    }

    if (query?.statusClass) {
      const base = Number(query.statusClass[0]) * 100;
      filtered = filtered.filter(
        (r) => r.statusCode >= base && r.statusCode < base + 100,
      );
    }

    const page = query?.page ? Number(query.page) : 1;
    const limit = query?.limit ? Number(query.limit) : 20;
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const data = filtered.slice((page - 1) * limit, page * limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  },

  "GET /environments/:id/resources": (params) => {
    return resourcesByEnv[params.id] ?? [];
  },

  "GET /resources/defaults": (_params, query) => {
    const types = (query?.type ?? "")
      .split(",")
      .filter(Boolean) as ResourceType[];
    const result: Partial<
      Record<ResourceType, (typeof RESOURCE_DEFAULTS)[ResourceType]>
    > = {};

    for (const type of types) {
      if (RESOURCE_DEFAULTS[type]) {
        result[type] = RESOURCE_DEFAULTS[type];
      }
    }

    return result;
  },

  "POST /environments/:environmentId/resources": (params, _query, body) => {
    const dto = (body ?? {}) as {
      type: ResourceType;
      name: string;
      credentials?: Record<string, string>;
    };

    const now = new Date().toISOString();

    const resource: Resource = {
      id: `res-${Date.now()}`,
      type: dto.type,
      name: dto.name,
      status: "provisioning",
      hostname: null,
      ports: null,
      credentials: dto.credentials ?? null,
      containerId: null,
      volumeId: null,
      networkId: null,
      environmentId: params.environmentId,
      createdAt: now,
      updatedAt: now,
    };

    if (!resourcesByEnv[params.environmentId]) {
      resourcesByEnv[params.environmentId] = [];
    }
    resourcesByEnv[params.environmentId].push(resource);

    return resource;
  },

  "GET /resources/:id": (params) => {
    const resource = findResourceById(params.id);
    if (!resource) throw new Error("Not found");
    return resource;
  },

  "DELETE /resources/:id": (params) => {
    for (const [envId, list] of Object.entries(resourcesByEnv)) {
      const index = list.findIndex((r) => r.id === params.id);
      if (index !== -1) {
        resourcesByEnv[envId].splice(index, 1);
        return;
      }
    }
    throw new Error("Not found");
  },

  "POST /resources/:id/clear": (params) => {
    const resource = findResourceById(params.id);
    if (!resource) throw new Error("Not found");
    resource.status = "provisioning";
    resource.updatedAt = new Date().toISOString();
    return { resourceId: resource.id, status: resource.status };
  },

  "GET /resources/:id/schema": (params) => {
    return { databases: schemaByResource[params.id] ?? [] };
  },

  "GET /resources/:id/tables": (params) => {
    return { tables: tablesByResource[params.id] ?? [] };
  },

  "GET /resources/:id/tables/:name": (params) => {
    return (
      tableDataByResource[params.id]?.[params.name] ?? {
        columns: [],
        rows: [],
        meta: {
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      }
    );
  },

  "POST /resources/:id/query": (params, _query, body) => {
    const { query } = (body ?? {}) as { query?: string };
    const trimmed = (query ?? "").trim();

    const isSql = /^(SELECT|SHOW|DESCRIBE|EXPLAIN)\b/i.test(trimmed);
    const isMongoShell =
      /^db\.\w+\.(find|findOne|aggregate|count|countDocuments|estimatedDocumentCount|distinct|explain)\s*\(/i.test(
        trimmed,
      );

    if (!isSql && !isMongoShell) {
      throw new Error(
        "Query not allowed. Workbench allows only read-only SQL statements or MongoDB shell queries",
      );
    }

    const tableMatch =
      /from\s+["'`]?(\w+)["'`]?/i.exec(trimmed) ?? /^db\.(\w+)\./i.exec(trimmed);
    const tableData = tableMatch
      ? tableDataByResource[params.id]?.[tableMatch[1]]
      : undefined;

    if (!tableData) {
      return { columns: [{ name: "result" }], rows: [], rowCount: 0 };
    }

    return {
      columns: tableData.columns.map((c) => ({ name: c.name, type: c.type })),
      rows: tableData.rows,
      rowCount: tableData.rows.length,
    };
  },

  "POST /environments/:environmentId/deploy": (params) => {
    const now = new Date().toISOString();

    const deployment: Deployment = {
      id: `dep-${Date.now()}`,
      commitSha: "",
      commitMessage: null,
      imageTag: null,
      containerId: null,
      trigger: "manual",
      buildStatus: "pending",
      failedStage: null,
      lifecycleStatus: "inactive",
      environmentId: params.environmentId,
      createdAt: now,
      completedAt: null,
      updatedAt: now,
    };

    if (!deploymentsByEnv[params.environmentId]) {
      deploymentsByEnv[params.environmentId] = [];
    }
    deploymentsByEnv[params.environmentId].unshift(deployment);
    deployments.push(deployment);

    return { deploymentId: deployment.id, status: deployment.buildStatus };
  },

  "GET /environments/:id/domains": (params) => {
    return domainsByEnv[params.id] ?? [];
  },

  "GET /domains/:id": (params) => {
    const domain = findDomainById(params.id);
    if (!domain) throw new Error("Not found");
    return domain;
  },

  "GET /domains/:id/instructions": (params) => {
    const domain = findDomainById(params.id);
    if (!domain) throw new Error("Not found");
    if (domain.status === "active" || domain.status === "failed") {
      throw new Error(
        "DNS instructions are only available for domains pending verification",
      );
    }
    return computeDnsInstructions(domain.hostname);
  },

  "POST /environments/:id/domains": (params, _query, body) => {
    const dto = (body ?? {}) as { hostname: string };
    const now = new Date().toISOString();

    const domain: Domain = {
      id: `dom-${Date.now()}`,
      hostname: dto.hostname,
      type: "custom",
      status: "pending",
      verifiedAt: null,
      environmentId: params.id,
      createdAt: now,
      updatedAt: now,
    };

    if (!domainsByEnv[params.id]) {
      domainsByEnv[params.id] = [];
    }
    domainsByEnv[params.id].push(domain);

    return computeDnsInstructions(dto.hostname);
  },

  "POST /domains/:id/retry-verification": (params) => {
    const domain = findDomainById(params.id);
    if (!domain) throw new Error("Not found");
    if (domain.type === "managed") {
      throw new Error("Managed hostnames cannot be retried");
    }
    if (domain.status !== "failed") {
      throw new Error("Only failed domains can be retried");
    }

    domain.status = "pending";
    domain.updatedAt = new Date().toISOString();

    return domain;
  },

  "DELETE /domains/:id": (params) => {
    for (const [envId, list] of Object.entries(domainsByEnv)) {
      const index = list.findIndex((d) => d.id === params.id);
      if (index !== -1) {
        domainsByEnv[envId].splice(index, 1);
        return;
      }
    }
    throw new Error("Not found");
  },

  "GET /github/install": () => ({
    url: "https://github.com/apps/orbit/installations/new",
  }),

  "GET /github/installations": () => githubInstallations,

  "DELETE /github/installations/:installationId": (params) => {
    const installationId = Number(params.installationId);

    const index = githubInstallations.findIndex(
      (i) => i.installationId === installationId,
    );
    if (index === -1) {
      throw new Error("Not found");
    }
    githubInstallations.splice(index, 1);

    const linkedProjectIds = projects
      .filter((p) => p.source?.installationId === installationId)
      .map((p) => p.id);

    for (const projectId of linkedProjectIds) {
      const projIndex = projects.findIndex((p) => p.id === projectId);
      if (projIndex !== -1) {
        projects.splice(projIndex, 1);
      }
      delete environments[projectId];
    }
  },

  "GET /github/installations/:installationId/repositories": (params) =>
    githubRepositories[Number(params.installationId)] ?? [],

  "GET /github/installations/:installationId/branches": (_params, query) => {
    if (query?.repo && githubBranches[query.repo]) {
      return githubBranches[query.repo];
    }
    return [{ name: "main" }];
  },

  "GET /github/installations/:installationId/update-access": (params) => ({
    url: `https://github.com/settings/installations/${params.installationId}`,
  }),

  "GET /slack/install": () => ({
    url: "https://slack.com/oauth/v2/authorize?client_id=mock&scope=commands",
  }),

  "DELETE /slack/installation": () => {
    if (user.slackInstallation) {
      user.slackInstallation.isActive = false;
    }
  },

  "POST /migrations/:provider/connect": (params, _query, body) => {
    const provider = params.provider as ExternalProvider;
    const dto = (body ?? {}) as { accessToken?: string };
    if (!dto.accessToken?.trim()) {
      throw new Error("Access token is required");
    }

    const label = provider === "railway" ? "Personal Account" : "orbit-team";
    const existing = user.externalConnections.find(
      (c) => c.provider === provider,
    );
    if (existing) {
      existing.label = label;
    } else {
      user.externalConnections.push({
        provider,
        label,
        createdAt: new Date().toISOString(),
      });
    }
  },

  "DELETE /migrations/:provider/connect": (params) => {
    const provider = params.provider as ExternalProvider;
    user.externalConnections = user.externalConnections.filter(
      (c) => c.provider !== provider,
    );
  },

  "GET /migrations/:provider/projects": (params) => {
    const provider = params.provider as ExternalProvider;
    return externalProjectSummaries[provider] ?? [];
  },

  "GET /migrations/:provider/projects/:externalId": (params) => {
    const detail = externalProjectDetails[params.externalId];
    if (!detail) throw new Error("External project not found");
    return detail;
  },

  "GET /activity": (_params, query) => {
    let logs = [...activityLogs];

    if (query?.projectId) {
      logs = logs.filter(
        (l) =>
          l.metadata?.projectId === query.projectId ||
          (l.metadata?.environmentId &&
            envToProjectId(l.metadata.environmentId as string) ===
              query.projectId),
      );
    }

    if (query?.deploymentId) {
      logs = logs.filter(
        (l) => l.metadata?.deploymentId === query.deploymentId,
      );
    }

    if (query?.resourceId) {
      logs = logs.filter((l) => l.metadata?.resourceId === query.resourceId);
    }

    if (query?.domainId) {
      logs = logs.filter((l) => l.metadata?.domainId === query.domainId);
    }

    if (query?.environmentId) {
      logs = logs.filter(
        (l) => l.metadata?.environmentId === query.environmentId,
      );
    }

    if (query?.type) {
      logs = logs.filter((l) => l.type === query.type);
    }

    const sorted = logs.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const page = query?.page ? Number(query.page) : 1;
    const limit = query?.limit ? Number(query.limit) : 20;
    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const data = sorted.slice((page - 1) * limit, page * limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  },
};

function envToProjectId(environmentId: string): string | undefined {
  for (const [projectId, envs] of Object.entries(environments)) {
    if (envs.some((e) => e.id === environmentId)) return projectId;
  }
  return undefined;
}

type MockResponse = { data: unknown } | { error: string };

export function resolveMock(
  method: string,
  path: string,
  body?: unknown,
): MockResponse | null {
  const [pathOnly, queryString] = path.split("?");
  const query = parseQuery(queryString);

  for (const [pattern, handler] of Object.entries(mockRoutes)) {
    const [routeMethod, routePath] = pattern.split(" ");
    if (routeMethod !== method) continue;

    const params = matchPath(routePath, pathOnly);
    if (params !== null) {
      try {
        const result = handler(params, query, body);
        return { data: result };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Not found" };
      }
    }
  }

  return null;
}

function parseQuery(queryString: string | undefined): QueryParams {
  if (!queryString) return {};
  const params: QueryParams = {};
  for (const [key, value] of new URLSearchParams(queryString)) {
    params[key] = value;
  }
  return params;
}

function matchPath(
  pattern: string,
  path: string,
): Record<string, string> | null {
  const patternParts = pattern.split("/");
  const pathParts = path.split("/");

  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(":")) {
      params[patternParts[i].slice(1)] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }

  return params;
}
