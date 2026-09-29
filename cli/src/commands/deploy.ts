import type { Command } from "commander";
import ora from "ora";
import { api } from "../lib/api.js";
import { ensureContext } from "../lib/config.js";
import { success, warn, statusBadge } from "../lib/format.js";
import { getCurrentBranch } from "../lib/git.js";
import { streamLogs } from "./logs.js";
import { fail, failWith } from "../lib/exit.js";

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
    let status: DeployStatus;
    try {
      status = await api.get<DeployStatus>(
        `/projects/${projectId}/deploy/${deploymentId}`,
        { "x-project-token": token },
      );
    } catch (err) {
      spinner.stop();
      throw err;
    }

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
      fail();
    }

    spinner.text = `Waiting for deployment to finish... ${statusBadge(status.buildStatus)}`;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  spinner.warn(
    "Build status check timed out. Check the dashboard to confirm the deployment status.",
  );
  fail();
}

export function registerDeployCommand(program: Command) {
  program
    .command("deploy")
    .description("Trigger a deployment for the linked environment")
    .option("-f, --follow", "Stream logs after triggering deployment")
    .option(
      "--token <secretAccessToken>",
      "Project access token for CI/CD without authentication (or set ORBIT_TOKEN)",
    )
    .option(
      "--project <projectId>",
      "Project ID, required with a token (or set ORBIT_PROJECT_ID)",
    )
    .action(
      async (options: {
        follow?: boolean;
        token?: string;
        project?: string;
      }) => {
        const projectToken = options.token || process.env.ORBIT_TOKEN;
        const projectId = options.project || process.env.ORBIT_PROJECT_ID;

        const spinner = ora("Triggering deployment...");

        try {
          spinner.start();

          let result: DeployResult;
          let jwt: string | undefined;

          if (projectToken) {
            if (!projectId) {
              spinner.stop();
              fail(
                "A project ID is required with a project token: pass --project or set ORBIT_PROJECT_ID.",
              );
            }

            const branch = getCurrentBranch();

            result = await api.post<DeployResult>(
              `/projects/${projectId}/deploy?branch=${encodeURIComponent(branch)}`,
              {},
              { "x-project-token": projectToken },
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
                projectId!,
                projectToken!,
                result.deploymentId,
              );
            }
          } else {
            console.log(
              `\nRun \`orbit logs ${result.deploymentId}\` to follow.`,
            );
          }
        } catch (err) {
          if (spinner.isSpinning) spinner.stop();
          failWith(err, "Deploy failed");
        }
      },
    );
}
