import type { Command } from 'commander';
import inquirer from 'inquirer';
import { api } from '../lib/api.js';
import { getContext, getToken } from '../lib/config.js';
import { success, error, info, printTable } from '../lib/format.js';

interface Domain {
  id: string;
  hostname: string;
  type: string;
  status: string;
}

export function registerDomainCommands(program: Command) {
  const domains = program
    .command('domains')
    .description('Manage custom domains');

  domains
    .command('ls')
    .description('List domains')
    .action(async () => {
      const ctx = ensureContext();

      try {
        const result = await api.get<Domain[]>(
          `/environments/${ctx.environmentId}/domains`,
        );

        if (result.length === 0) {
          console.log('No domains configured.');
          return;
        }

        const headers = ['Hostname', 'Type', 'Status'];
        const rows = result.map((d) => [d.hostname, d.type, d.status]);

        printTable(headers, rows);
      } catch (err) {
        error(err instanceof Error ? err.message : 'Failed to list domains');
        process.exit(1);
      }
    });

  domains
    .command('add <hostname>')
    .description('Add a custom domain')
    .action(async (hostname: string) => {
      const ctx = ensureContext();

      try {
        await api.post(`/environments/${ctx.environmentId}/domains`, {
          hostname,
        });

        success(`Domain "${hostname}" added.`);
        info('Configure these DNS records:');
        if (hostname.includes('.') && hostname.split('.').length === 2) {
          info(`  A record for @ → INGRESS_IP`);
        } else {
          info(`  CNAME record → INGRESS_HOST`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : 'Failed to add domain');
        process.exit(1);
      }
    });

  domains
    .command('rm <hostname>')
    .description('Remove a custom domain')
    .action(async (hostname: string) => {
      const ctx = ensureContext();

      try {
        const all = await api.get<Domain[]>(
          `/environments/${ctx.environmentId}/domains`,
        );
        const domain = all.find(
          (d) => d.hostname === hostname && d.type === 'custom',
        );

        if (!domain) {
          error(`Custom domain "${hostname}" not found.`);
          process.exit(1);
        }

        const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Remove domain "${hostname}"?`,
            default: false,
          },
        ]);

        if (!confirm) return;

        await api.del(`/domains/${domain.id}`);
        success(`Domain "${hostname}" removed.`);
      } catch (err) {
        error(err instanceof Error ? err.message : 'Failed to remove domain');
        process.exit(1);
      }
    });
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
