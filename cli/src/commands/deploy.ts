import type { Command } from "commander";
import ora from "ora";
import { api } from "../lib/api.js";
import { ensureContext } from "../lib/config.js";
import { success, error, warn, statusBadge } from "../lib/format.js";
import { getCurrentBranch } from "../lib/git.js";
import { streamLogs } from "./logs.js";

interface DeployResult {
  deploymentId: string;
  status: string;
}

interface DeployStatus {
  buildStatus: string;
  hostname?: string;
}

const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

async function pollDeploymentStatus(
  projectId: string,
  token: string,
  deploymentId: string,
): Promise<void> {
  const spinner = ora("Waiting for deployment to finish...").start();
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const status = await api.get<DeployStatus>(
      `/projects/${projectId}/deploy/${deploymentId}`,
      { "x-project-token": token },
    );

    if (status.buildStatus === "ready") {
      spinner.succeed(
        status.hostname
          ? `Deployment is live at https://${status.hostname}`
          : "Deployment is live.",
      );
      return;
    }

    if (status.buildStatus === "failed" || status.buildStatus === "aborted") {
      spinner.fail(`Deployment ${status.buildStatus}.`);
      process.exit(1);
    }

    spinner.text = `Waiting for deployment to finish... ${statusBadge(status.buildStatus)}`;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  spinner.warn(
    "Build status check timed out. Check the dashboard to confirm the deployment status.",
  );
  process.exit(1);
}

export function registerDeployCommand(program: Command) {
  program
    .command("deploy")
    .description("Trigger a deployment for the linked environment")
    .option("-f, --follow", "Stream logs after triggering deployment")
    .option(
      "--token <secretAccessToken>",
      "Project access token for CI/CD without authentication",
    )
    .option("--project <projectId>", "Project ID (required with --token)")
    .action(
      async (options: {
        follow?: boolean;
        token?: string;
        project?: string;
      }) => {
        try {
          const spinner = ora("Triggering deployment...").start();

          let result: DeployResult;
          let jwt: string | undefined;

          if (options.token) {
            if (!options.project) {
              spinner.stop();
              error("--project is required when using --token.");
              process.exit(1);
            }

            const branch = getCurrentBranch();

            result = await api.post<DeployResult>(
              `/projects/${options.project}/deploy?branch=${encodeURIComponent(branch)}`,
              {},
              { "x-project-token": options.token },
            );
          } else {
            const { ctx, token } = ensureContext();
            jwt = token;

            result = await api.post<DeployResult>(
              `/environments/${ctx.environmentId}/deploy?resource_count=0`,
            );
          }

          spinner.stop();

          success(`Deployment triggered: ${result.deploymentId}`);

          warn("Managed databases can be created via the Orbit dashboard.");

          if (options.follow) {
            if (jwt) {
              await streamLogs(jwt, result.deploymentId);
            } else {
              await pollDeploymentStatus(
                options.project!,
                options.token!,
                result.deploymentId,
              );
            }
          } else {
            console.log(
              `\nRun \`orbit logs ${result.deploymentId}\` to follow.`,
            );
          }
        } catch (err) {
          error(err instanceof Error ? err.message : "Deploy failed");
          process.exit(1);
        }
      },
    );
}
