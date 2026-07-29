import type { Command } from 'commander';
import { api } from '../lib/api.js';
import { getContext, getToken } from '../lib/config.js';
import {
  error,
  success,
  statusBadge,
  shortSha,
  formatTimestamp,
} from '../lib/format.js';

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
  commitSha?: string;
  createdAt: string;
}

interface Domain {
  hostname: string;
}

interface DeployResponse {
  id: string;
}

export function registerInfoCommand(program: Command) {
  program
    .command('info')
    .description('Show current project and environment status')
    .action(async () => {
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

      try {
        const project = await api.get<Project>(
          `/projects/${ctx.projectId}`,
        );
        const env = await api.get<Environment>(
          `/projects/${ctx.projectId}/environments/${ctx.environmentId}`,
        );

        const deps = await api.get<{
          data: Deployment[];
        }>(
          `/environments/${ctx.environmentId}/deployments?limit=1`,
        );
        const latest = deps.data[0];

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
          console.log('Status:      not deployed');
        }

        try {
          const domains = await api.get<Domain[]>(
            `/environments/${ctx.environmentId}/domains`,
          );
          if (domains.length > 0) {
            console.log(
              `URLs:`,
            );
            for (const d of domains) {
              console.log(`             https://${d.hostname}`);
            }
          }
        } catch {
          // domains fetch is optional
        }
      } catch (err) {
        error(err instanceof Error ? err.message : 'Info failed');
        process.exit(1);
      }
    });
}

export function registerRedeployCommand(program: Command) {
  program
    .command('redeploy [deployment-id]')
    .description('Redeploy using the same image (skips build)')
    .option('-f, --follow', 'Stream logs')
    .action(async (deploymentId?: string, options?: { follow?: boolean }) => {
      const token = getToken();
      if (!token) {
        error('Not authenticated. Run `orbit auth login` first.');
        process.exit(1);
      }

      const ctx = getContext();

      try {
        if (!deploymentId && ctx) {
          const deps = await api.get<{
            data: Deployment[];
          }>(
            `/environments/${ctx.environmentId}/deployments?limit=1`,
          );
          deploymentId = deps.data[0]?.id;
        }

        if (!deploymentId) {
          error('No deployment to redeploy.');
          process.exit(1);
        }

        const result = await api.post<DeployResponse>(
          `/deployments/${deploymentId}/redeploy`,
        );

        success(`Redeploy triggered: ${result.id}`);

        if (options?.follow) {
          const { streamLogs } = await import('./logs.js');
          await streamLogs(result.id);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : 'Redeploy failed');
        process.exit(1);
      }
    });
}

export function registerRollbackCommand(program: Command) {
  program
    .command('rollback [deployment-id]')
    .description('Rollback to a previous deployment')
    .option('-f, --follow', 'Stream logs')
    .action(async (deploymentId?: string, options?: { follow?: boolean }) => {
      const token = getToken();
      if (!token) {
        error('Not authenticated. Run `orbit auth login` first.');
        process.exit(1);
      }

      const ctx = getContext();

      try {
        if (!deploymentId && ctx) {
          const deps = await api.get<{
            data: Deployment[];
          }>(
            `/environments/${ctx.environmentId}/deployments?limit=10`,
          );

          const active = deps.data.find(
            (d) => d.buildStatus === 'ready' || d.buildStatus === 'active',
          );

          if (!active || deps.data.length < 2) {
            error('No previous deployment to rollback to.');
            process.exit(1);
          }

          deploymentId = deps.data[1]?.id;
        }

        if (!deploymentId) {
          error('No deployment specified for rollback.');
          process.exit(1);
        }

        const result = await api.post<DeployResponse>(
          `/deployments/${deploymentId}/rollback`,
        );

        success(`Rollback triggered: ${result.id}`);

        if (options?.follow) {
          const { streamLogs } = await import('./logs.js');
          await streamLogs(result.id);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : 'Rollback failed');
        process.exit(1);
      }
    });
}
