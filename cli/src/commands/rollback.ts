import type { Command } from "commander";
import { api } from "../lib/api.js";
import { ensureAuth, ensureContext } from "../lib/config.js";
import { error, success } from "../lib/format.js";
import { streamLogs } from "./logs.js";

interface Deployment {
  id: string;
}

interface PaginatedDeployments {
  data: Deployment[];
}

interface DeployResult {
  deploymentId: string;
  status: string;
}

export function registerRollbackCommand(program: Command) {
  program
    .command("rollback [deployment-id]")
    .description("Rollback to a previous deployment")
    .option("-f, --follow", "Stream logs")
    .action(async (deploymentId?: string, options?: { follow?: boolean }) => {
      const token = ensureAuth();

      try {
        if (!deploymentId) {
          const ctx = ensureContext();

          const deps = await api.get<PaginatedDeployments>(
            `/environments/${ctx.environmentId}/deployments?limit=10`,
          );

          if (!deps.data[0] || deps.data.length < 2) {
            error("No previous deployment to rollback to.");
            process.exit(1);
          }

          deploymentId = deps.data[1]!.id;
        }

        if (!deploymentId) {
          error("No deployment specified for rollback.");
          process.exit(1);
        }

        const result = await api.post<DeployResult>(
          `/deployments/${deploymentId}/rollback`,
        );

        success(`Rollback triggered: ${result.deploymentId}`);

        if (options?.follow) {
          await streamLogs(token, result.deploymentId);
        } else {
          console.log(`\nRun \`orbit logs ${result.deploymentId}\` to follow.`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Rollback failed");
        process.exit(1);
      }
    });
}
