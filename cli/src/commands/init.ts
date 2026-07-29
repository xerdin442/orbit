import type { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import { api } from '../lib/api.js';
import { setContext, getToken } from '../lib/config.js';
import { success, error } from '../lib/format.js';

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

interface DeployResponse {
  id: string;
}

export function registerInitCommand(program: Command) {
  program
    .command('init')
    .description('Create a new project and deploy')
    .action(async () => {
      const token = getToken();
      if (!token) {
        error('Not authenticated. Run `orbit auth login` first.');
        process.exit(1);
      }

      try {
        const installations = await api.get<Installation[]>(
          '/github/installations',
        );

        if (installations.length === 0) {
          error(
            'No GitHub installations found. Install the Orbit GitHub App first.',
          );
          process.exit(1);
        }

        const { installationId } = await inquirer.prompt<{
          installationId: string;
        }>([
          {
            type: 'list',
            name: 'installationId',
            message: 'Select a GitHub installation:',
            choices: installations.map((inst) => ({
              name: inst.accountLogin,
              value: inst.id,
            })),
          },
        ]);

        const spinner = ora('Fetching repositories...').start();
        const repos = await api.get<Repository[]>(
          `/github/${installationId}/repositories`,
        );
        spinner.stop();

        const { repo } = await inquirer.prompt<{ repo: string }>([
          {
            type: 'list',
            name: 'repo',
            message: 'Select a repository:',
            choices: repos.map((r) => ({
              name: r.full_name,
              value: r.full_name,
            })),
          },
        ]);

        spinner.start('Fetching branches...');
        const branches = await api.get<Branch[]>(
          `/github/branches?installationId=${installationId}&repo=${encodeURIComponent(repo)}`,
        );
        spinner.stop();

        const { branch } = await inquirer.prompt<{ branch: string }>([
          {
            type: 'list',
            name: 'branch',
            message: 'Select the default branch:',
            choices: branches.map((b) => b.name),
            default: 'main',
          },
        ]);

        const repoName = repo.split('/')[1] ?? 'my-app';

        const { name } = await inquirer.prompt<{ name: string }>([
          {
            type: 'input',
            name: 'name',
            message: 'Project name:',
            default: repoName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
            validate: (input: string) =>
              input.length >= 1 ? true : 'Project name is required',
          },
        ]);

        spinner.start('Creating project...');
        const project = await api.post<{
          id: string;
          environments: { id: string; name: string }[];
        }>('/projects', {
          name,
          repositoryUrl: `https://github.com/${repo}`,
          defaultBranch: branch,
          installationId,
        });
        spinner.stop();

        const envId = project.environments[0]?.id;
        if (!envId) {
          error('Failed to create environment.');
          process.exit(1);
        }

        setContext({
          projectId: project.id,
          environmentId: envId,
          projectName: name,
        });

        success(`Project "${name}" created.`);

        const { deploy } = await inquirer.prompt<{ deploy: boolean }>([
          {
            type: 'confirm',
            name: 'deploy',
            message: 'Deploy now?',
            default: true,
          },
        ]);

        if (deploy) {
          spinner.start('Triggering deployment...');
          const dep = await api.post<DeployResponse>(
            `/environments/${envId}/deploy?resource_count=0`,
          );
          spinner.stop();

          success(
            `Deployment triggered (${dep.id}). Run \`orbit logs\` to follow.`,
          );
        }
      } catch (err) {
        error(err instanceof Error ? err.message : 'Initialization failed');
        process.exit(1);
      }
    });
}
