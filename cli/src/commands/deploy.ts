import type { Command } from 'commander';
import ora from 'ora';
import { api } from '../lib/api.js';
import { getContext, getToken } from '../lib/config.js';
import { success, error, warn } from '../lib/format.js';
import { streamLogs } from './logs.js';

interface DeployResponse {
  id: string;
}

export function registerDeployCommand(program: Command) {
  program
    .command('deploy')
    .description('Trigger a deployment for the linked environment')
    .option('-f, --follow', 'Stream logs after triggering')
    .action(async (options: { follow?: boolean }) => {
      const token = getToken();
      if (!token) {
        error('Not authenticated. Run `orbit auth login` first.');
        process.exit(1);
      }

      const ctx = getContext();
      if (!ctx) {
        error(
          'No linked environment. Run `orbit init` or `orbit link` first.',
        );
        process.exit(1);
      }

      try {
        const spinner = ora('Triggering deployment...').start();
        const result = await api.post<DeployResponse>(
          `/environments/${ctx.environmentId}/deploy?resource_count=0`,
        );
        spinner.stop();

        success(`Deployment triggered: ${result.id}`);

        warn(
          'Managed databases can be created via the Orbit dashboard.',
        );

        if (options.follow) {
          await streamLogs(result.id);
        } else {
          console.log(`\nRun \`orbit logs ${result.id}\` to follow.`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : 'Deploy failed');
        process.exit(1);
      }
    });
}
