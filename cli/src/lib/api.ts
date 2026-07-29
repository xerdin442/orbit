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
): Promise<T> {
  const token = ensureAuth();
  const url = `${getApiUrl()}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    error("Not authenticated. Run `orbit auth login`.");
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
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, body?: unknown) => Promise<T>;
  patch: <T>(path: string, body?: unknown) => Promise<T>;
  del: <T>(path: string) => Promise<T>;
};

export const api: ApiClient = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
};
