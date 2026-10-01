import type { Command } from "commander";
import { api } from "../lib/api.js";
import { ensureContext } from "../lib/config.js";
import { error, success } from "../lib/format.js";
import { streamLogs } from "./logs.js";

interface Deployment {
  id: string;
  lifecycleStatus: string;
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
      const { ctx, token } = ensureContext();

      try {
        if (!deploymentId) {
          // Only a successful deployment that isn't currently live can be rolled back to.
          const deps = await api.get<PaginatedDeployments>(
            `/environments/${ctx.environmentId}/deployments?status=ready&limit=20`,
          );

          const target = deps.data.find(
            (d) => d.lifecycleStatus === "inactive",
          );

          if (!target) {
            error("No previous successful deployment to rollback to.");
            process.exit(1);
          }

          deploymentId = target.id;
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
