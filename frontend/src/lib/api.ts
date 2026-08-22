import type {
  User,
  Project,
  Environment,
  Deployment,
  DeploymentDetail,
  DeploymentLog,
  Resource,
  ResourceDefaultKey,
  Domain,
  DNSInstructions,
  EnvironmentVariable,
  GitHubInstallation,
  GitHubRepository,
  GitHubBranch,
  ActivityLog,
  ExternalProvider,
  ExternalProjectSummary,
  ExternalProjectDetail,
  DatabaseSchema,
  TableObject,
  TableData,
  QueryResult,
  PaginatedResult,
  CreateProjectPayload,
  CreateEnvironmentPayload,
  UpdateEnvironmentPayload,
  CreateVariablePayload,
  UpdateVariablePayload,
  CreateResourcePayload,
  AddDomainPayload,
  ResourceType,
  RequestLog,
  StatusClass,
} from "@/lib/types";
import { resolveMock } from "@/mocks/handler";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
const MOCK_MODE = process.env.NEXT_PUBLIC_MOCK_MODE === "true";

const TOKEN_KEY = "orbit_access_token";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

function withAuthToken(url: string): string {
  const token = getAuthToken();
  if (!token) return url;
  return `${url}?token=${encodeURIComponent(token)}`;
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function showRequestError(message: string): void {
  toast.error("Request failed", { description: message, duration: 5000 });
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (MOCK_MODE) {
    const method = (options.method as string) ?? "GET";
    const body =
      typeof options.body === "string" ? JSON.parse(options.body) : undefined;
    const mock = resolveMock(method, path, body);

    if (mock) {
      if ("error" in mock) {
        showRequestError(mock.error);
        throw new Error(mock.error);
      }

      const json = mock;
      if (
        json &&
        typeof json === "object" &&
        "data" in json &&
        "meta" in json
      ) {
        return json as T;
      }
      return (json?.data !== undefined ? json.data : json) as T;
    }

    console.log("No mock found for: ", method, path);
    return {} as T;
  }

  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const errorField = body?.error;
    const message: string =
      typeof errorField === "string"
        ? errorField
        : (errorField?.message ?? body?.message ?? res.statusText);

    if (res.status === 401) {
      clearAuthToken();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    } else if (res.status === 403) {
      if (typeof window !== "undefined") {
        window.location.href = "/403";
      }
    } else {
      showRequestError(message);
    }

    throw new Error(message);
  }

  const json = await res.json();
  if (json && typeof json === "object" && "data" in json && "meta" in json) {
    return json as T;
  }
  return (json?.data !== undefined ? json.data : json) as T;
}

export const api = {
  auth: {
    me: () => request<User>("/auth/me"),
    githubLoginUrl: () =>
      request<{ url: string }>("/auth/github").then((r) => r.url),
  },

  projects: {
    list: () => request<Project[]>("/projects"),
    get: (id: string) => request<Project>(`/projects/${id}`),
    create: (payload: CreateProjectPayload) =>
      request<{ project: Project; environmentId: string }>("/projects", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    update: (id: string, payload: Partial<CreateProjectPayload>) =>
      request<Project>(`/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    delete: (id: string) =>
      request<void>(`/projects/${id}`, { method: "DELETE" }),
    branches: (id: string) =>
      request<GitHubBranch[]>(`/projects/${id}/branches`),
    rotateToken: (id: string) =>
      request<Project>(`/projects/${id}/tokens/rotate`, { method: "POST" }),
  },

  github: {
    installUrl: () =>
      request<{ url: string }>("/github/install").then((r) => r.url),
    installations: () => request<GitHubInstallation[]>("/github/installations"),
    remove: (installationId: number) =>
      request<void>(`/github/installations/${installationId}`, {
        method: "DELETE",
      }),
    repositories: (installationId: number) =>
      request<GitHubRepository[]>(
        `/github/installations/${installationId}/repositories`,
      ),
    branches: (installationId: number, repoFullName: string) =>
      request<GitHubBranch[]>(
        `/github/installations/${installationId}/branches?repo=${repoFullName}`,
      ),
    updateAccessUrl: (installationId: number) =>
      request<{ url: string }>(
        `/github/installations/${installationId}/update-access`,
      ).then((r) => r.url),
  },

  slack: {
    installUrl: () =>
      request<{ url: string }>("/slack/install").then((r) => r.url),
    disconnect: () =>
      request<void>("/slack/installation", { method: "DELETE" }),
  },

  migrations: {
    connect: (provider: ExternalProvider, accessToken: string) =>
      request<void>(`/migrations/${provider}/connect`, {
        method: "POST",
        body: JSON.stringify({ accessToken }),
      }),
    disconnect: (provider: ExternalProvider) =>
      request<void>(`/migrations/${provider}/connect`, { method: "DELETE" }),
    listProjects: (provider: ExternalProvider) =>
      request<ExternalProjectSummary[]>(`/migrations/${provider}/projects`),
    getProject: (provider: ExternalProvider, externalId: string) =>
      request<ExternalProjectDetail>(
        `/migrations/${provider}/projects/${externalId}`,
      ),
  },

  environments: {
    list: (projectId: string) =>
      request<Environment[]>(`/projects/${projectId}/environments`),
    get: (projectId: string, id: string) =>
      request<Environment>(`/projects/${projectId}/environments/${id}`),
    create: (projectId: string, payload: CreateEnvironmentPayload) =>
      request<Environment>(`/projects/${projectId}/environments`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    update: (
      projectId: string,
      id: string,
      payload: UpdateEnvironmentPayload,
    ) =>
      request<Environment>(`/projects/${projectId}/environments/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    delete: (projectId: string, id: string) =>
      request<void>(`/projects/${projectId}/environments/${id}`, {
        method: "DELETE",
      }),

    variables: {
      list: (projectId: string, environmentId: string) =>
        request<EnvironmentVariable[]>(
          `/projects/${projectId}/environments/${environmentId}/variables`,
        ),
      create: (
        projectId: string,
        environmentId: string,
        payload: CreateVariablePayload,
        skipRedeploy = false,
      ) =>
        request<EnvironmentVariable>(
          `/projects/${projectId}/environments/${environmentId}/variables?skip_redeploy=${skipRedeploy}`,
          { method: "POST", body: JSON.stringify(payload) },
        ),
      bulkCreate: (
        projectId: string,
        environmentId: string,
        variables: CreateVariablePayload[],
        skipRedeploy = false,
      ) =>
        request<EnvironmentVariable[]>(
          `/projects/${projectId}/environments/${environmentId}/variables/bulk?skip_redeploy=${skipRedeploy}`,
          { method: "POST", body: JSON.stringify({ variables }) },
        ),
      update: (
        projectId: string,
        id: string,
        payload: UpdateVariablePayload,
        skipRedeploy = false,
      ) =>
        request<EnvironmentVariable>(
          `/projects/${projectId}/environments/variables/${id}?skip_redeploy=${skipRedeploy}`,
          { method: "PATCH", body: JSON.stringify(payload) },
        ),
      delete: (projectId: string, id: string, skipRedeploy = false) =>
        request<void>(
          `/projects/${projectId}/environments/variables/${id}?skip_redeploy=${skipRedeploy}`,
          { method: "DELETE" },
        ),
    },

    deploy: (environmentId: string, resourceCount: number) =>
      request<{ deploymentId: string; status: string }>(
        `/environments/${environmentId}/deploy?resource_count=${resourceCount}`,
        { method: "POST" },
      ),
    redeploy: (environmentId: string) =>
      request<{ deploymentId: string; status: string }>(
        `/environments/${environmentId}/redeploy`,
        { method: "POST" },
      ),
  },

  deployments: {
    get: (id: string) => request<DeploymentDetail>(`/deployments/${id}`),
    listByEnvironment: (
      environmentId: string,
      params?: {
        page?: number;
        limit?: number;
        trigger?: string;
        status?: string;
        startDate?: string;
        endDate?: string;
      },
    ) => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set("page", String(params.page));
      if (params?.limit) searchParams.set("limit", String(params.limit));
      if (params?.trigger) searchParams.set("trigger", params.trigger);
      if (params?.status) searchParams.set("status", params.status);
      if (params?.startDate) searchParams.set("startDate", params.startDate);
      if (params?.endDate) searchParams.set("endDate", params.endDate);
      const qs = searchParams.toString();
      return request<PaginatedResult<Deployment>>(
        `/environments/${environmentId}/deployments${qs ? `?${qs}` : ""}`,
      );
    },
    rollback: (id: string) =>
      request<{ deploymentId: string; status: string }>(
        `/deployments/${id}/rollback`,
        { method: "POST" },
      ),
    abort: (id: string, markedResources?: string[]) =>
      request<void>(`/deployments/${id}/abort`, {
        method: "POST",
        body: JSON.stringify({ marked_resources: markedResources ?? [] }),
      }),
    logs: (id: string) => request<DeploymentLog[]>(`/deployments/${id}/logs`),
    logsStreamUrl: (id: string) =>
      withAuthToken(`${API_URL}/deployments/${id}/logs/stream`),
  },

  resources: {
    defaults: (types: ResourceType[]) =>
      request<Partial<Record<ResourceType, ResourceDefaultKey[]>>>(
        `/resources/defaults?type=${types.join(",")}`,
      ),
    list: (environmentId: string) =>
      request<Resource[]>(`/environments/${environmentId}/resources`),
    create: (environmentId: string, payload: CreateResourcePayload) =>
      request<Resource>(`/environments/${environmentId}/resources`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    get: (id: string) => request<Resource>(`/resources/${id}`),
    clear: (id: string) =>
      request<{ resourceId: string; status: string }>(
        `/resources/${id}/clear`,
        { method: "POST" },
      ),
    delete: (id: string) =>
      request<void>(`/resources/${id}`, { method: "DELETE" }),
  },

  workbench: {
    schema: (resourceId: string) =>
      request<{ databases: DatabaseSchema[] }>(
        `/resources/${resourceId}/schema`,
      ),
    tables: (resourceId: string) =>
      request<{ tables: TableObject[] }>(`/resources/${resourceId}/tables`),
    tableData: (
      resourceId: string,
      tableName: string,
      params?: {
        page?: number;
        limit?: number;
        sort?: string;
        filter?: string;
      },
    ) => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set("page", String(params.page));
      if (params?.limit) searchParams.set("limit", String(params.limit));
      if (params?.sort) searchParams.set("sort", params.sort);
      if (params?.filter) searchParams.set("filter", params.filter);
      const qs = searchParams.toString();
      return request<TableData>(
        `/resources/${resourceId}/tables/${tableName}${qs ? `?${qs}` : ""}`,
      );
    },
    executeQuery: (resourceId: string, query: string) =>
      request<QueryResult>(`/resources/${resourceId}/query`, {
        method: "POST",
        body: JSON.stringify({ query }),
      }),
  },

  domains: {
    list: (environmentId: string) =>
      request<Domain[]>(`/environments/${environmentId}/domains`),
    get: (id: string) => request<Domain>(`/domains/${id}`),
    instructions: (id: string) =>
      request<DNSInstructions>(`/domains/${id}/instructions`),
    add: (environmentId: string, payload: AddDomainPayload) =>
      request<DNSInstructions>(`/environments/${environmentId}/domains`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    retryVerification: (id: string) =>
      request<Domain>(`/domains/${id}/retry-verification`, {
        method: "POST",
      }),
    delete: (id: string) =>
      request<void>(`/domains/${id}`, { method: "DELETE" }),
  },

  requestLogs: {
    list: (
      environmentId: string,
      params?: {
        page?: number;
        limit?: number;
        method?: string;
        statusClass?: StatusClass;
      },
    ) => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set("page", String(params.page));
      if (params?.limit) searchParams.set("limit", String(params.limit));
      if (params?.method) searchParams.set("method", params.method);
      if (params?.statusClass)
        searchParams.set("statusClass", params.statusClass);
      const qs = searchParams.toString();
      return request<PaginatedResult<RequestLog>>(
        `/environments/${environmentId}/requests${qs ? `?${qs}` : ""}`,
      );
    },
    streamUrl: (environmentId: string) =>
      withAuthToken(`${API_URL}/environments/${environmentId}/requests/stream`),
  },

  activity: {
    list: (params?: {
      projectId?: string;
      deploymentId?: string;
      resourceId?: string;
      domainId?: string;
      environmentId?: string;
      type?: string;
    }) => {
      const searchParams = new URLSearchParams();
      if (params?.projectId) searchParams.set("projectId", params.projectId);
      if (params?.deploymentId)
        searchParams.set("deploymentId", params.deploymentId);
      if (params?.resourceId) searchParams.set("resourceId", params.resourceId);
      if (params?.domainId) searchParams.set("domainId", params.domainId);
      if (params?.environmentId)
        searchParams.set("environmentId", params.environmentId);
      if (params?.type) searchParams.set("type", params.type);
      const qs = searchParams.toString();
      return request<ActivityLog[]>(`/activity${qs ? `?${qs}` : ""}`);
    },
  },
};
