import Conf from "conf";
import { error, warn } from "./format.js";

interface OrbitContext {
  projectId: string;
  environmentId: string;
  projectName: string;
}

interface OrbitConfig {
  token?: string;
  apiUrl?: string;
  currentContext?: OrbitContext;
}

export const config = new Conf<OrbitConfig>({
  projectName: "orbit",
  configFileMode: 0o600, // secure mode, only readable by the owner
  // Overrides the OS default location (tests, CI runners, multiple profiles)
  ...(process.env.ORBIT_CONFIG_DIR
    ? { cwd: process.env.ORBIT_CONFIG_DIR }
    : {}),
});

const API_URL_NOTICE = `No Orbit API URL is configured.

Orbit is self-hosted, so the CLI has no default server: it must be pointed at
the API of the Orbit instance you (or your team) run. Set it with one of:

  orbit auth login --api-url https://<your-orbit-host>/api
  orbit --api-url https://<your-orbit-host>/api <command>   (saved for later commands)
  export ORBIT_API_URL=https://<your-orbit-host>/api        (current shell only; use this in CI)`;

let insecureWarningShown = false;

function normalizeApiUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    error(
      `Invalid Orbit API URL: "${raw}". Expected e.g. https://<your-orbit-host>/api`,
    );
    process.exit(1);
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    error(`Invalid Orbit API URL: "${raw}". It must start with https://`);
    process.exit(1);
  }

  const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol === "http:" && !isLocal && !insecureWarningShown) {
    insecureWarningShown = true;
    warn(
      `The Orbit API URL uses plain http:// (${url.host}). Your session and project tokens will be sent unencrypted; use https:// for production environments.`,
    );
  }

  return url.toString().replace(/\/+$/, "");
}

export function getApiUrl(): string {
  const raw = process.env.ORBIT_API_URL || config.get("apiUrl");

  if (!raw) {
    error(API_URL_NOTICE);
    process.exit(1);
  }

  return normalizeApiUrl(raw);
}

export function setApiUrl(url: string) {
  config.set("apiUrl", normalizeApiUrl(url));
}

export function setToken(token: string) {
  config.set("token", token);
}

export function setContext(ctx: OrbitContext) {
  config.set("currentContext", ctx);
}

export function clearToken() {
  config.delete("token");
}

export function clearAll() {
  config.clear();
}

export function ensureAuth(): string {
  const token = config.get("token");
  if (!token) {
    error("Not authenticated. Run `orbit auth login` first.");
    process.exit(1);
  }
  return token;
}

export function ensureContext(): {
  ctx: NonNullable<OrbitContext>;
  token: string;
} {
  const token = ensureAuth();

  const ctx = config.get("currentContext");
  if (!ctx) {
    error("No linked environment. Run `orbit link` first.");
    process.exit(1);
  }

  return { ctx, token };
}
