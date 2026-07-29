import type { Command } from 'commander';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import { api } from '../lib/api.js';
import { getContext, getToken } from '../lib/config.js';
import { success, error, warn, printTable } from '../lib/format.js';

interface EnvVariable {
  id: string;
  key: string;
  value: string;
}

export function registerEnvCommands(program: Command) {
  const env = program
    .command('env')
    .description('Manage environment variables');

  env
    .command('ls')
    .description('List environment variables')
    .action(async () => {
      const ctx = ensureContext();

      try {
        const vars = await api.get<EnvVariable[]>(
          `/projects/${ctx.projectId}/environments/${ctx.environmentId}/variables`,
        );

        if (vars.length === 0) {
          console.log('No environment variables set.');
          return;
        }

        const headers = ['Key', 'Value'];
        const rows = vars.map((v) => [
          v.key,
          v.value.length > 40 ? v.value.slice(0, 40) + '...' : v.value,
        ]);

        printTable(headers, rows);
      } catch (err) {
        error(err instanceof Error ? err.message : 'Failed to list variables');
        process.exit(1);
      }
    });

  env
    .command('set <key> <value>')
    .description('Set an environment variable')
    .action(async (key: string, value: string) => {
      const ctx = ensureContext();

      try {
        const existing = await api.get<EnvVariable[]>(
          `/projects/${ctx.projectId}/environments/${ctx.environmentId}/variables`,
        );
        const existingVar = existing.find((v) => v.key === key);

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

        success(`Variable "${key}" set. Redeploy triggered.`);
      } catch (err) {
        error(err instanceof Error ? err.message : 'Failed to set variable');
        process.exit(1);
      }
    });

  env
    .command('rm <key>')
    .description('Delete an environment variable')
    .action(async (key: string) => {
      const ctx = ensureContext();

      try {
        const existing = await api.get<EnvVariable[]>(
          `/projects/${ctx.projectId}/environments/${ctx.environmentId}/variables`,
        );
        const existingVar = existing.find((v) => v.key === key);

        if (!existingVar) {
          error(`Variable "${key}" not found.`);
          process.exit(1);
        }

        const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Delete "${key}"? This will trigger a redeploy.`,
            default: false,
          },
        ]);

        if (!confirm) return;

        await api.del(
          `/projects/${ctx.projectId}/environments/variables/${existingVar.id}`,
        );

        success(`Variable "${key}" deleted. Redeploy triggered.`);
      } catch (err) {
        error(err instanceof Error ? err.message : 'Failed to delete variable');
        process.exit(1);
      }
    });

  env
    .command('import <file>')
    .description('Import environment variables from a .env file')
    .action(async (filePath: string) => {
      const ctx = ensureContext();

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const vars = parseEnvFile(content);

        if (vars.length === 0) {
          error('No variables found in file.');
          process.exit(1);
        }

        warn(`Importing ${vars.length} variables. This will trigger a redeploy.`);

        const existing = await api.get<EnvVariable[]>(
          `/projects/${ctx.projectId}/environments/${ctx.environmentId}/variables`,
        );

        for (const { key, value } of vars) {
          const existingVar = existing.find((v) => v.key === key);
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
          process.stdout.write(`  ${key} ✔\n`);
        }

        success('Import complete. Redeploy triggered.');
      } catch (err) {
        error(err instanceof Error ? err.message : 'Import failed');
        process.exit(1);
      }
    });
}

function parseEnvFile(content: string): { key: string; value: string }[] {
  const vars: { key: string; value: string }[] = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    const eqIdx = trimmed.indexOf('=');
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

function ensureContext() {
  const token = getToken();
  if (!token) {
    error('Not authenticated. Run `orbit auth login` first.');
    process.exit(1);
  }

  const ctx = getContext();
  if (!ctx) {
    error('No linked environment. Run `orbit link` first.');
    process.exit(1);
  }

  return ctx;
}
