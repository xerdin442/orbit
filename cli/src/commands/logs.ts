import type { Command } from "commander";
import chalk from "chalk";
import { api, apiFetch } from "../lib/api.js";
import { ensureContext } from "../lib/config.js";
import { fail, failWith } from "../lib/exit.js";

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
            fail("No deployments found.");
          }

          deploymentId = latest.id;
        }

        await streamLogs(token, deploymentId);
      } catch (err) {
        failWith(err, "Failed to fetch logs");
      }
    });
}

export async function streamLogs(
  token: string,
  deploymentId: string,
): Promise<void> {
  const response = await apiFetch(`/deployments/${deploymentId}/logs/stream`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok || !response.body) {
    fail("Failed to connect to log stream.");
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
