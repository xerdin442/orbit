import type { Command } from "commander";
import { api } from "../lib/api.js";
import { ensureContext } from "../lib/config.js";
import {
  error,
  statusBadge,
  shortSha,
  formatTimestamp,
} from "../lib/format.js";

interface Project {
  id: string;
  name: string;
}

interface Environment {
  id: string;
  name: string;
  branch: string;
}

interface Deployment {
  id: string;
  buildStatus: string;
  commitSha: string;
  createdAt: string;
}

interface PaginatedDeployments {
  data: Deployment[];
}

interface Domain {
  hostname: string;
  status: string;
}

export function registerInfoCommand(program: Command) {
  program
    .command("info")
    .description("Show current project and environment status")
    .action(async () => {
      const { ctx } = ensureContext();

      try {
        const [project, env, deps, domains] = await Promise.all([
          api.get<Project>(`/projects/${ctx.projectId}`),
          api.get<Environment>(
            `/projects/${ctx.projectId}/environments/${ctx.environmentId}`,
          ),
          api.get<PaginatedDeployments>(
            `/environments/${ctx.environmentId}/deployments?limit=1`,
          ),
          api.get<Domain[]>(`/environments/${ctx.environmentId}/domains`),
        ]);

        const latest = deps.data[0];
        const activeDomains = domains.filter((d) => d.status === "active");

        console.log(`Project:     ${project.name}`);
        console.log(`Environment: ${env.name} (branch: ${env.branch})`);

        if (latest) {
          console.log(
            `Status:      ${statusBadge(latest.buildStatus)} (${formatTimestamp(latest.createdAt)})`,
          );
          if (latest.commitSha) {
            console.log(`Commit:      ${shortSha(latest.commitSha)}`);
          }
        } else {
          console.log("Status:      not deployed");
        }

        if (activeDomains.length > 0) {
          console.log("URLs:");
          for (const d of activeDomains) {
            console.log(`             https://${d.hostname}`);
          }
        } else {
          console.log("URLs:        No active domains");
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Info failed");
        process.exit(1);
      }
    });
}
