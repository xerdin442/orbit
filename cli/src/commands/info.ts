import type { Command } from "commander";
import { api } from "../lib/api.js";
import { ensureContext } from "../lib/config.js";
import { statusBadge, shortSha, formatTimestamp } from "../lib/format.js";
import { failWith } from "../lib/exit.js";

interface Project {
  id: string;
  name: string;
}

interface Environment {
  id: string;
  name: string;
  branch: string;
  currentDeploymentId: string | null;
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

function describe(d: Deployment): string {
  const commit = d.commitSha ? ` ${shortSha(d.commitSha)}` : "";
  return `${statusBadge(d.buildStatus)}${commit} (${formatTimestamp(d.createdAt)})`;
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
        const live = env.currentDeploymentId
          ? latest?.id === env.currentDeploymentId
            ? latest
            : await api.get<Deployment>(
                `/deployments/${env.currentDeploymentId}`,
              )
          : undefined;
        const activeDomains = domains.filter((d) => d.status === "active");

        console.log(`Project:     ${project.name}`);
        console.log(`Environment: ${env.name} (branch: ${env.branch})`);
        console.log(`Live:        ${live ? describe(live) : "not deployed"}`);

        // Surface a newer in-progress or failed deployment that isn't live.
        if (latest && latest.id !== live?.id) {
          console.log(`Latest:      ${describe(latest)}`);
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
        failWith(err, "Info failed");
      }
    });
}
