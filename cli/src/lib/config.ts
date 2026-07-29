import Conf from "conf";
import { error } from "./format.js";

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
  defaults: {
    apiUrl: process.env.ORBIT_API_URL ?? "http://localhost:3000/api",
  },
});

export function getApiUrl(): string {
  return config.get("apiUrl", "http://localhost:3000/api");
}

export function setToken(token: string) {
  config.set("token", token);
}

export function setApiUrl(url: string) {
  config.set("apiUrl", url);
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

export function ensureContext(): NonNullable<OrbitContext> {
  ensureAuth();

  const ctx = config.get("currentContext");
  if (!ctx) {
    error("No linked environment. Run `orbit link` first.");
    process.exit(1);
  }

  return ctx;
}
