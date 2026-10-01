import type { Command } from 'commander';
import { api } from '../lib/api.js';
import { getContext, getToken } from '../lib/config.js';
import {
  error,
  statusBadge,
  shortSha,
  formatDuration,
  formatTimestamp,
  printTable,
} from '../lib/format.js';

interface Deployment {
  id: string;
  buildStatus: string;
  commitSha?: string;
  commitMessage?: string;
  trigger?: string;
  createdAt: string;
  completedAt?: string;
}

export function registerListCommand(program: Command) {
  program
    .command('list')
    .alias('ls')
    .description('List recent deployments')
    .option('--limit <n>', 'Number of deployments', '10')
    .action(async (options: { limit: string }) => {
      const token = getToken();
      if (!token) {
        error('Not authenticated. Run `orbit auth login` first.');
        process.exit(1);
      }

      const ctx = getContext();
      if (!ctx) {
        error(
          'No linked environment. Run `orbit link` first.',
        );
        process.exit(1);
      }

      try {
        const result = await api.get<{
          data: Deployment[];
        }>(
          `/environments/${ctx.environmentId}/deployments?limit=${options.limit}&page=1`,
        );

        if (result.data.length === 0) {
          console.log('No deployments yet.');
          return;
        }

        const headers = ['Status', 'Commit', 'Message', 'Trigger', 'Duration'];
        const rows = result.data.map((d) => [
          statusBadge(d.buildStatus),
          d.commitSha ? shortSha(d.commitSha) : '-',
          (d.commitMessage ?? '-').slice(0, 50),
          d.trigger ?? '-',
          formatDuration(new Date(d.createdAt), d.completedAt ? new Date(d.completedAt) : null),
        ]);

        printTable(headers, rows);
      } catch (err) {
        error(err instanceof Error ? err.message : 'List failed');
        process.exit(1);
      }
    });
}
