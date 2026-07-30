import type { Command } from "commander";
import ora from "ora";
import { api } from "../lib/api.js";
import { ensureContext } from "../lib/config.js";
import { success, error, warn } from "../lib/format.js";
import { streamLogs } from "./logs.js";

interface DeployResult {
  deploymentId: string;
  status: string;
}

export function registerDeployCommand(program: Command) {
  program
    .command("deploy")
    .description("Trigger a deployment for the linked environment")
    .option("-f, --follow", "Stream logs after triggering deployment")
    .action(async (options: { follow?: boolean }) => {
      const { ctx, token } = ensureContext();

      try {
        const spinner = ora("Triggering deployment...").start();
        const result = await api.post<DeployResult>(
          `/environments/${ctx.environmentId}/deploy?resource_count=0`,
        );
        spinner.stop();

        success(`Deployment triggered: ${result.deploymentId}`);

        warn("Managed databases can be created via the Orbit dashboard.");

        if (options.follow) {
          await streamLogs(token, result.deploymentId);
        } else {
          console.log(`\nRun \`orbit logs ${result.deploymentId}\` to follow.`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Deploy failed");
        process.exit(1);
      }
    });
}
