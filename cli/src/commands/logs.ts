import type { Command } from "commander";
import chalk from "chalk";
import { api } from "../lib/api.js";
import { getApiUrl, ensureContext } from "../lib/config.js";
import { error } from "../lib/format.js";

interface Deployment {
  id: string;
}

interface PaginatedDeployments {
  data: Deployment[];
}

interface LogEntry {
  level: string;
  message: string;
}

const LOG_COLORS: Record<string, typeof chalk.white> = {
  INFO: chalk.white,
  WARN: chalk.yellow,
  ERROR: chalk.red,
  SUCCESS: chalk.green,
};

export function registerLogsCommand(program: Command) {
  program
    .command("logs [deployment-id]")
    .description("Stream or view deployment logs")
    .action(async (deploymentId?: string) => {
      const { ctx, token } = ensureContext();

      try {
        if (!deploymentId) {
          const deps = await api.get<PaginatedDeployments>(
            `/environments/${ctx.environmentId}/deployments?limit=1`,
          );

          const latest = deps.data[0];
          if (!latest) {
            error("No deployments found.");
            process.exit(1);
          }

          deploymentId = latest.id;
        }

        await streamLogs(token, deploymentId);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to fetch logs");
        process.exit(1);
      }
    });
}

export async function streamLogs(
  token: string,
  deploymentId: string,
): Promise<void> {
  const baseUrl = getApiUrl();
  const url = `${baseUrl}/deployments/${deploymentId}/logs/stream?token=${token}`;

  const response = await fetch(url);

  if (!response.ok || !response.body) {
    error("Failed to connect to log stream.");
    process.exit(1);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const entry = JSON.parse(line.slice(6)) as LogEntry;
            const color = LOG_COLORS[entry.level] ?? chalk.white;
            console.log(color(`${entry.level.padEnd(7)} ${entry.message}`));
          } catch {
            console.log(line.slice(6));
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
