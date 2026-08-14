import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type {
  BuildStatus,
  DeploymentLog,
  DomainStatus,
  ExternalProvider,
  LogLevel,
  ResourceType,
  VariableEntry,
} from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function maskValue(value: string): string {
  return "•".repeat(Math.min(value.length, 24)) || "•".repeat(8);
}

export function buildStatusBadgeVariant(
  status: BuildStatus,
): "ready" | "failed" | "building" | "inactive" {
  if (status === "ready") return "ready";
  if (status === "failed") return "failed";
  if (status === "building" || status === "pending") return "building";
  return "inactive";
}

export function domainSslVariant(
  status: DomainStatus,
): "ready" | "pending" | "failed" {
  if (status === "active") return "ready";
  if (status === "failed") return "failed";
  return "pending";
}

export function requestStatusVariant(
  statusCode: number,
): "ready" | "inactive" | "warning" | "failed" {
  if (statusCode < 300) return "ready";
  if (statusCode < 400) return "inactive";
  if (statusCode < 500) return "warning";
  return "failed";
}

export function domainSslLabel(status: DomainStatus): string {
  if (status === "active") return "Issued";
  if (status === "failed") return "Not issued";
  return "Pending";
}

export function isBuildInProgress(status: BuildStatus): boolean {
  const TERMINAL_BUILD_STATUSES: BuildStatus[] = ["ready", "failed", "aborted"];
  return !TERMINAL_BUILD_STATUSES.includes(status);
}

export function formatDuration(start: string, end: string | null): string {
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  const totalSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));

  if (totalSeconds < 60) return `${totalSeconds}s`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

export const ENV_FILENAME_PATTERN = /^\.env(\..+)?$/i;

export function parseEnvFile(content: string): VariableEntry[] {
  const result: VariableEntry[] = [];
  const seen = new Set<string>();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!key) continue;

    if (seen.has(key)) {
      throw new Error(`Duplicate variable "${key}" found in file`);
    }
    seen.add(key);

    result.push({ key, value });
  }

  return result;
}

export function formatLogLine(log: DeploymentLog): string {
  const time = new Date(log.timestamp).toLocaleTimeString();
  return `[${time}] ${log.level.padEnd(8)} ${log.message}`;
}

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  postgres: "PostgreSQL",
  mysql: "MySQL",
  redis: "Redis",
  mongo: "MongoDB",
};

export const RESOURCE_TYPE_LOGOS: Record<ResourceType, string> = {
  postgres: "/postgres.png",
  mysql: "/mysql.png",
  redis: "/redis.png",
  mongo: "/mongo.png",
};

export const PROVIDER_LABEL: Record<ExternalProvider, string> = {
  railway: "Railway",
  vercel: "Vercel",
};

export const PROVIDER_LOGOS: Record<ExternalProvider, string> = {
  railway: "/railway.png",
  vercel: "/vercel.png",
};

const WORKBENCH_SUPPORTED_TYPES: ResourceType[] = [
  "postgres",
  "mysql",
  "mongo",
];

export function supportsWorkbench(type: ResourceType): boolean {
  return WORKBENCH_SUPPORTED_TYPES.includes(type);
}

export function logLevelColor(level: LogLevel): string {
  const LOG_LEVEL_COLOR: Record<LogLevel, string> = {
    INFO: "text-foreground/85",
    WARN: "text-amber-400",
    SUCCESS: "text-green-400",
    ERROR: "text-red-400",
  };

  return LOG_LEVEL_COLOR[level];
}
