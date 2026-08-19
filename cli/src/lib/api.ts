import { ensureAuth, getApiUrl } from "./config.js";
import { error } from "./format.js";

interface ApiError {
  error?: { message?: string };
  message?: string;
}

export class OrbitApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "OrbitApiError";
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  authHeaders?: Record<string, string>,
): Promise<T> {
  const url = `${getApiUrl()}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(authHeaders ?? { Authorization: `Bearer ${ensureAuth()}` }),
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    error(
      authHeaders
        ? "Invalid or unauthorized project access token."
        : "Not authenticated. Run `orbit auth login`.",
    );
    process.exit(1);
  }

  if (!response.ok) {
    const json = (await response.json().catch(() => ({}))) as ApiError;
    const message = json.error?.message ?? json.message ?? response.statusText;
    throw new OrbitApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const json = (await response.json()) as Record<string, unknown>;

  if (json && "data" in json && !("meta" in json)) {
    return json.data as T;
  }

  return json as T;
}

type ApiClient = {
  get: <T>(path: string, authHeaders?: Record<string, string>) => Promise<T>;
  post: <T>(
    path: string,
    body?: unknown,
    authHeaders?: Record<string, string>,
  ) => Promise<T>;
  patch: <T>(
    path: string,
    body?: unknown,
    authHeaders?: Record<string, string>,
  ) => Promise<T>;
  del: <T>(path: string, authHeaders?: Record<string, string>) => Promise<T>;
};

export const api: ApiClient = {
  get: <T>(path: string, authHeaders?: Record<string, string>) =>
    request<T>("GET", path, undefined, authHeaders),
  post: <T>(
    path: string,
    body?: unknown,
    authHeaders?: Record<string, string>,
  ) => request<T>("POST", path, body, authHeaders),
  patch: <T>(
    path: string,
    body?: unknown,
    authHeaders?: Record<string, string>,
  ) => request<T>("PATCH", path, body, authHeaders),
  del: <T>(path: string, authHeaders?: Record<string, string>) =>
    request<T>("DELETE", path, undefined, authHeaders),
};
