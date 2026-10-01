import type { Command } from 'commander';
import { api, OrbitApiError } from '../lib/api.js';
import { config, setToken, clearToken, getToken, setApiUrl } from '../lib/config.js';
import { success, error, warn, info } from '../lib/format.js';
import { startAuthServer } from '../lib/auth-server.js';

interface AuthMeResponse {
  id: string;
  githubUsername: string;
  email?: string;
  avatarUrl?: string;
}

export function registerAuthCommands(program: Command) {
  const auth = program
    .command('auth')
    .description('Manage authentication');

  auth
    .command('login')
    .description('Authenticate with GitHub')
    .option('--api-url <url>', 'Orbit API URL')
    .action(async (options: { apiUrl?: string }) => {
      if (options.apiUrl) {
        setApiUrl(options.apiUrl);
      }

      try {
        const token = await startAuthServer();
        setToken(token);
        success('Logged in successfully.');
      } catch (err) {
        error(err instanceof Error ? err.message : 'Login failed');
        process.exit(1);
      }
    });

  auth
    .command('logout')
    .description('Clear stored credentials')
    .action(() => {
      clearToken();
      success('Logged out.');
    });

  auth
    .command('whoami')
    .description('Show authenticated user')
    .action(async () => {
      const token = getToken();
      if (!token) {
        info('Not logged in. Run `orbit auth login`.');
        return;
      }

      try {
        const user = await api.get<AuthMeResponse>('/auth/me');
        console.log(`Logged in as ${user.githubUsername}`);
        if (user.email) {
          console.log(`Email: ${user.email}`);
        }
      } catch (err) {
        if (err instanceof OrbitApiError && err.status === 401) {
          clearToken();
          info('Session expired. Run `orbit auth login`.');
        } else {
          throw err;
        }
      }
    });
}
