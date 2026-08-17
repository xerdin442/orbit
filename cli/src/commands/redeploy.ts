import type { Command } from "commander";
import { api } from "../lib/api.js";
import { ensureContext } from "../lib/config.js";
import { error, success } from "../lib/format.js";
import { streamLogs } from "./logs.js";

interface DeployResult {
  deploymentId: string;
  status: string;
}

export function registerRedeployCommand(program: Command) {
  program
    .command("redeploy")
    .description("Redeploy the environment's current deployment (skips build)")
    .option("-f, --follow", "Stream logs")
    .action(async (options?: { follow?: boolean }) => {
      const { ctx, token } = ensureContext();

      try {
        const result = await api.post<DeployResult>(
          `/environments/${ctx.environmentId}/redeploy`,
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
