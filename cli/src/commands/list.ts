import type { Command } from "commander";
import { api } from "../lib/api.js";
import { ensureContext } from "../lib/config.js";
import {
  error,
  statusBadge,
  shortSha,
  formatDuration,
  printTable,
} from "../lib/format.js";

interface Deployment {
  id: string;
  buildStatus: string;
  commitSha: string;
  commitMessage: string | null;
  trigger: string;
  createdAt: string;
  completedAt: string | null;
}

interface PaginatedDeployments {
  data: Deployment[];
}

export function registerListCommand(program: Command) {
  program
    .command("list")
    .alias("ls")
    .description("List recent deployments")
    .option("--limit <n>", "Number of deployments", "10")
    .action(async (options: { limit: string }) => {
      const { ctx } = ensureContext();

      try {
        const result = await api.get<PaginatedDeployments>(
          `/environments/${ctx.environmentId}/deployments?limit=${options.limit}&page=1`,
        );

        if (result.data.length === 0) {
          console.log("No deployments yet.");
          return;
        }

        const headers = ["Status", "Commit", "Message", "Trigger", "Duration"];
        const rows = result.data.map((d) => [
          statusBadge(d.buildStatus),
          shortSha(d.commitSha),
          (d.commitMessage ?? "-").slice(0, 50),
          d.trigger,
          formatDuration(
            new Date(d.createdAt),
            d.completedAt ? new Date(d.completedAt) : null,
          ),
        ]);

        printTable(headers, rows);
      } catch (err) {
        error(err instanceof Error ? err.message : "List failed");
        process.exit(1);
      }
    });
}
