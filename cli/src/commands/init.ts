import type { Command } from "commander";
import inquirer from "inquirer";
import ora from "ora";
import fs from "fs-extra";
import { api } from "../lib/api.js";
import { setContext, ensureAuth } from "../lib/config.js";
import { success, error } from "../lib/format.js";
import { parseEnvFile } from "./env.js";

interface Installation {
  id: string;
  installationId: number;
  accountLogin: string;
}

interface Repository {
  id: number;
  full_name: string;
  name: string;
}

interface Branch {
  name: string;
}

interface CreatedProject {
  environmentId: string;
  project: {
    id: string;
    name: string;
    source: {
      repositoryUrl: string;
      defaultBranch: string;
    } | null;
  };
}

interface Environment {
  id: string;
  name: string;
}

interface DeployResult {
  deploymentId: string;
  status: string;
}

export function registerInitCommand(program: Command) {
  program
    .command("init")
    .description("Create a new project and deploy")
    .action(async () => {
      ensureAuth();

      try {
        const installations = await api.get<Installation[]>(
          "/github/installations",
        );

        if (installations.length === 0) {
          error(
            "No GitHub installations found. Install the Orbit GitHub App first.",
          );
          process.exit(1);
        }

        const { inst } = await inquirer.prompt<{ inst: Installation }>([
          {
            type: "list",
            name: "inst",
            message: "Select a GitHub installation:",
            choices: installations.map((i) => ({
              name: i.accountLogin,
              value: i,
            })),
          },
        ]);

        const spinner = ora("Fetching repositories...").start();
        const repos = await api.get<Repository[]>(
          `/github/installations/${inst.installationId}/repositories`,
        );
        spinner.stop();

        const { repo } = await inquirer.prompt<{ repo: string }>([
          {
            type: "list",
            name: "repo",
            message: "Select a repository:",
            choices: repos.map((r) => ({
              name: r.full_name,
              value: r.full_name,
            })),
          },
        ]);

        spinner.start("Fetching branches...");
        const branches = await api.get<Branch[]>(
          `/github/installations/${inst.installationId}/branches?repo=${encodeURIComponent(repo)}`,
        );
        spinner.stop();

        const { branch } = await inquirer.prompt<{ branch: string }>([
          {
            type: "list",
            name: "branch",
            message: "Select the default branch:",
            choices: branches.map((b) => b.name),
          },
        ]);

        const repoName = repo.split("/")[1] ?? "my-app";

        const { name } = await inquirer.prompt<{ name: string }>([
          {
            type: "input",
            name: "name",
            message: "Project name:",
            default: repoName.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
            validate: (input: string) =>
              input.length >= 3
                ? true
                : "Project name must be at least 3 characters",
          },
        ]);

        const { envPath } = await inquirer.prompt<{ envPath: string }>([
          {
            type: "input",
            name: "envPath",
            message: "Path to .env file (optional):",
            default: "",
          },
        ]);

        let envVars: Record<string, string> | undefined;

        if (envPath) {
          try {
            const content = await fs.readFile(envPath, "utf-8");
            const parsed = parseEnvFile(content);
            if (parsed.length > 0) {
              envVars = Object.fromEntries(parsed.map((v) => [v.key, v.value]));
              success(`Parsed ${parsed.length} variables from ${envPath}`);
            }
          } catch {
            error(`Could not read file: ${envPath}`);
            process.exit(1);
          }
        }

        spinner.start("Creating project...");
        const created = await api.post<CreatedProject>("/projects", {
          name,
          repositoryUrl: `https://github.com/${repo}`,
          defaultBranch: branch,
          installationId: inst.installationId,
          ...(envVars ? { envVars } : {}),
        });
        spinner.stop();

        setContext({
          projectId: created.project.id,
          environmentId: created.environmentId,
          projectName: name,
        });

        success(`Project "${name}" created.`);

        const { deploy } = await inquirer.prompt<{ deploy: boolean }>([
          {
            type: "confirm",
            name: "deploy",
            message: "Deploy now?",
            default: true,
          },
        ]);

        if (deploy) {
          spinner.start("Triggering deployment...");
          const result = await api.post<DeployResult>(
            `/environments/${created.environmentId}/deploy?resource_count=0`,
          );
          spinner.stop();

          success(
            `Deployment triggered (${result.deploymentId}). Run \`orbit logs\` to follow.`,
          );
        }
      } catch (err) {
        error(err instanceof Error ? err.message : "Initialization failed");
        process.exit(1);
      }
    });
}
