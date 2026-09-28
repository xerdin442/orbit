import type { Command } from "commander";
import inquirer from "inquirer";
import { api } from "../lib/api.js";
import { ensureContext } from "../lib/config.js";
import { error, success } from "../lib/format.js";

interface Deployment {
  id: string;
  buildStatus: string;
}

interface PaginatedDeployments {
  data: Deployment[];
}

const IN_PROGRESS = ["pending", "cloning", "building", "deploying"];

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
          if (!latest || !IN_PROGRESS.includes(latest.buildStatus)) {
            error("No deployment in progress.");
            process.exit(1);
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
        error(err instanceof Error ? err.message : "Abort failed");
        process.exit(1);
      }
    });
}
