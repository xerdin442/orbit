import type { Command } from "commander";
import inquirer from "inquirer";
import fs from "fs-extra";
import { api } from "../lib/api.js";
import { ensureContext } from "../lib/config.js";
import { success, error, warn, printTable } from "../lib/format.js";

interface EnvVariable {
  id: string;
  key: string;
  value: string;
}

interface Environment {
  currentDeploymentId: string | null;
}

async function hasLiveDeployment(
  projectId: string,
  environmentId: string,
): Promise<boolean> {
  const env = await api.get<Environment>(
    `/projects/${projectId}/environments/${environmentId}`,
  );
  return !!env.currentDeploymentId;
}

function redeployNote(live: boolean): string {
  return live
    ? "Redeploy triggered."
    : "This change will apply on the next deploy (nothing is live yet).";
}

export function registerEnvCommands(program: Command) {
  const env = program
    .command("env")
    .description("Manage environment variables");

  env
    .command("ls")
    .description("List environment variables")
    .action(async () => {
      const { ctx } = ensureContext();

      try {
        const vars = await api.get<EnvVariable[]>(
          `/projects/${ctx.projectId}/environments/${ctx.environmentId}/variables`,
        );

        if (vars.length === 0) {
          console.log("No environment variables set.");
          return;
        }

        const headers = ["Key", "Value"];
        const rows = vars.map((v) => [
          v.key,
          v.value.length > 40 ? v.value.slice(0, 40) + "..." : v.value,
        ]);

        printTable(headers, rows);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to list variables");
        process.exit(1);
      }
    });

  env
    .command("set <key> <value>")
    .description("Set an environment variable")
    .action(async (key: string, value: string) => {
      const { ctx } = ensureContext();

      if (value === "") {
        error(
          "Value cannot be empty. Use `orbit env rm` to remove a variable.",
        );
        process.exit(1);
      }

      try {
        const existing = await api.get<EnvVariable[]>(
          `/projects/${ctx.projectId}/environments/${ctx.environmentId}/variables`,
        );
        const existingVar = existing.find((v) => v.key === key);
        const live = await hasLiveDeployment(ctx.projectId, ctx.environmentId);

        if (existingVar) {
          await api.patch(
            `/projects/${ctx.projectId}/environments/variables/${existingVar.id}`,
            { value },
          );
        } else {
          await api.post(
            `/projects/${ctx.projectId}/environments/${ctx.environmentId}/variables`,
            { key, value },
          );
        }

        success(`Variable "${key}" set. ${redeployNote(live)}`);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to set variable");
        process.exit(1);
      }
    });

  env
    .command("rm <key>")
    .description("Delete an environment variable")
    .action(async (key: string) => {
      const { ctx } = ensureContext();

      try {
        const existing = await api.get<EnvVariable[]>(
          `/projects/${ctx.projectId}/environments/${ctx.environmentId}/variables`,
        );
        const existingVar = existing.find((v) => v.key === key);
        const live = await hasLiveDeployment(ctx.projectId, ctx.environmentId);

        if (!existingVar) {
          error(`Variable "${key}" not found.`);
          process.exit(1);
        }

        const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
          {
            type: "confirm",
            name: "confirm",
            message: `Delete "${key}"?${live ? " This will trigger a redeploy." : ""}`,
            default: false,
          },
        ]);

        if (!confirm) return;

        await api.del(
          `/projects/${ctx.projectId}/environments/variables/${existingVar.id}`,
        );

        success(`Variable "${key}" deleted. ${redeployNote(live)}`);
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to delete variable");
        process.exit(1);
      }
    });

  env
    .command("import <file>")
    .description("Import environment variables from a .env file")
    .action(async (filePath: string) => {
      const { ctx } = ensureContext();

      try {
        const content = await fs.readFile(filePath, "utf-8");
        const byKey = new Map<string, string>();
        const empty: string[] = [];
        for (const { key, value } of parseEnvFile(content)) {
          if (value === "") {
            empty.push(key);
            byKey.delete(key);
          } else {
            byKey.set(key, value);
          }
        }
        const vars = [...byKey].map(([key, value]) => ({ key, value }));

        if (empty.length > 0) {
          warn(`Skipping variables with empty values: ${empty.join(", ")}`);
        }

        if (vars.length === 0) {
          error("No variables found in file.");
          process.exit(1);
        }

        warn(`Importing ${vars.length} variables...`);

        const basePath = `/projects/${ctx.projectId}/environments/${ctx.environmentId}/variables`;
        const existing = await api.get<EnvVariable[]>(basePath);

        const toPatch: { id: string; key: string; value: string }[] = [];
        const toCreate: { key: string; value: string }[] = [];

        for (const { key, value } of vars) {
          const existingVar = existing.find((v) => v.key === key);
          if (existingVar) {
            toPatch.push({ id: existingVar.id, key, value });
          } else {
            toCreate.push({ key, value });
          }
        }

        if (toCreate.length > 0) {
          await api.post(`${basePath}/bulk?skip_redeploy=true`, {
            variables: toCreate,
          });
          for (const { key } of toCreate) {
            process.stdout.write(`  ${key} ✔ (new)\n`);
          }
        }

        for (const { id, key, value } of toPatch) {
          await api.patch(
            `/projects/${ctx.projectId}/environments/variables/${id}?skip_redeploy=true`,
            { value },
          );
          process.stdout.write(`  ${key} ✔ (updated)\n`);
        }

        // Only variables changed, so reuse the live image; build only if nothing is live yet.
        const live = await hasLiveDeployment(ctx.projectId, ctx.environmentId);
        const result = await api.post<{ deploymentId: string }>(
          live
            ? `/environments/${ctx.environmentId}/redeploy`
            : `/environments/${ctx.environmentId}/deploy?resource_count=0`,
        );

        success(
          `Import complete. ${live ? "Redeploy" : "Deployment"} triggered: ${result.deploymentId}`,
        );

        console.log(`\nRun \`orbit logs ${result.deploymentId}\` to follow.`);
      } catch (err) {
        error(err instanceof Error ? err.message : "Import failed");
        process.exit(1);
      }
    });
}

export function parseEnvFile(
  content: string,
): { key: string; value: string }[] {
  const vars: { key: string; value: string }[] = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;

    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) {
      vars.push({ key, value });
    }
  }

  return vars;
}
