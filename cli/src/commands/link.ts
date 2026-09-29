import type { Command } from "commander";
import inquirer from "inquirer";
import { api } from "../lib/api.js";
import { setContext, ensureAuth } from "../lib/config.js";
import { success } from "../lib/format.js";
import { fail, failWith } from "../lib/exit.js";

interface Project {
  id: string;
  name: string;
}

interface Environment {
  id: string;
  name: string;
}

export function registerLinkCommand(program: Command) {
  program
    .command("link")
    .description("Link current directory to an existing project")
    .action(async () => {
      ensureAuth();

      try {
        const projects = await api.get<Project[]>("/projects");

        if (projects.length === 0) {
          fail("No projects found. Run `orbit init` to create one.");
        }

        const { projectId } = await inquirer.prompt<{ projectId: string }>([
          {
            type: "select",
            name: "projectId",
            message: "Select a project:",
            choices: projects.map((p) => ({
              name: p.name,
              value: p.id,
            })),
          },
        ]);

        const environments = await api.get<Environment[]>(
          `/projects/${projectId}/environments`,
        );

        const { environmentId } = await inquirer.prompt<{
          environmentId: string;
        }>([
          {
            type: "select",
            name: "environmentId",
            message: "Select an environment:",
            choices: environments.map((env) => ({
              name: env.name,
              value: env.id,
            })),
          },
        ]);

        const project = projects.find((p) => p.id === projectId);

        setContext({
          projectId,
          environmentId,
          projectName: project?.name ?? "unknown",
        });

        success(
          `Linked to project "${project?.name ?? "unknown"}" (${environments.find((e) => e.id === environmentId)?.name ?? ""}).`,
        );
      } catch (err) {
        failWith(err, "Link failed");
      }
    });
}
