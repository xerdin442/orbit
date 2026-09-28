import { ensureAuth, getApiUrl } from "./config.js";

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

export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const apiUrl = getApiUrl();
  try {
    return await fetch(`${apiUrl}${path}`, init);
  } catch {
    throw new Error(
      `Could not reach the Orbit API at ${apiUrl}. Check that the URL is correct and the server is running.`,
    );
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  authHeaders?: Record<string, string>,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(authHeaders ?? { Authorization: `Bearer ${ensureAuth()}` }),
  };

  const response = await apiFetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    throw new OrbitApiError(
      authHeaders
        ? "Invalid or unauthorized project access token."
        : "Session expired or invalid. Run `orbit auth login`.",
      401,
    );
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
