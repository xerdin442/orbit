import type { Command } from "commander";
import { api } from "../lib/api.js";
import { ensureContext } from "../lib/config.js";
import { success } from "../lib/format.js";
import {
  pickRollbackTarget,
  type DeploymentSummary,
} from "../lib/deployments.js";
import { streamLogs } from "./logs.js";
import { fail, failWith } from "../lib/exit.js";

interface PaginatedDeployments {
  data: DeploymentSummary[];
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
          const deps = await api.get<PaginatedDeployments>(
            `/environments/${ctx.environmentId}/deployments?status=ready&limit=20`,
          );

          const target = pickRollbackTarget(deps.data);

          if (!target) {
            fail("No previous successful deployment to rollback to.");
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
        failWith(err, "Rollback failed");
      }
    });
}
