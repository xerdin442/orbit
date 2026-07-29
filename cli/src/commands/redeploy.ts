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

export function registerRedeployCommand(program: Command) {
  program
    .command("redeploy [deployment-id]")
    .description("Redeploy using the same image (skips build)")
    .option("-f, --follow", "Stream logs")
    .action(async (deploymentId?: string, options?: { follow?: boolean }) => {
      const token = ensureAuth();

      try {
        if (!deploymentId) {
          const ctx = ensureContext();

          const deps = await api.get<PaginatedDeployments>(
            `/environments/${ctx.environmentId}/deployments?limit=1`,
          );
          deploymentId = deps.data[0]?.id;
        }

        if (!deploymentId) {
          error("No deployment to redeploy.");
          process.exit(1);
        }

        const result = await api.post<DeployResult>(
          `/deployments/${deploymentId}/redeploy`,
        );

        success(`Redeploy triggered: ${result.deploymentId}`);

        if (options?.follow) {
          await streamLogs(token, result.deploymentId);
        } else {
          console.log(`\nRun \`orbit logs ${result.deploymentId}\` to follow.`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Redeploy failed");
        process.exit(1);
      }
    });
}
