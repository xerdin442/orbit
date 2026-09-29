import type { Command } from "commander";
import inquirer from "inquirer";
import { api } from "../lib/api.js";
import { ensureContext } from "../lib/config.js";
import { success } from "../lib/format.js";
import { isInProgress, type DeploymentSummary } from "../lib/deployments.js";
import { fail, failWith } from "../lib/exit.js";

interface PaginatedDeployments {
  data: DeploymentSummary[];
}

export function registerAbortCommand(program: Command) {
  program
    .command("abort [deployment-id]")
    .description("Abort an in-progress deployment (defaults to the latest)")
    .action(async (deploymentId?: string) => {
      const { ctx } = ensureContext();

      try {
        if (!deploymentId) {
          const deps = await api.get<PaginatedDeployments>(
            `/environments/${ctx.environmentId}/deployments?limit=1`,
          );

          const latest = deps.data[0];
          if (!latest || !isInProgress(latest.buildStatus)) {
            fail("No deployment in progress.");
          }

          deploymentId = latest.id;
        }

        const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
          {
            type: "confirm",
            name: "confirm",
            message: `Abort deployment ${deploymentId}? This cannot be undone.`,
            default: false,
          },
        ]);

        if (!confirm) return;

        await api.post(`/deployments/${deploymentId}/abort`);
        success(`Deployment ${deploymentId} aborted.`);
      } catch (err) {
        failWith(err, "Abort failed");
      }
    });
}
