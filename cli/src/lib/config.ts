import Conf from 'conf';

interface OrbitConfig {
  token?: string;
  apiUrl?: string;
  currentContext?: {
    projectId: string;
    environmentId: string;
    projectName: string;
  };
}

export const config = new Conf<OrbitConfig>({
  projectName: 'orbit',
  defaults: {
    apiUrl: process.env.ORBIT_API_URL ?? 'http://localhost:3000/api',
  },
});

export function getToken(): string | undefined {
  return config.get('token');
}

export function getApiUrl(): string {
  return config.get('apiUrl', 'http://localhost:3000/api');
}

export function getContext() {
  return config.get('currentContext');
}

export function setToken(token: string) {
  config.set('token', token);
}

export function setApiUrl(url: string) {
  config.set('apiUrl', url);
}

export function setContext(ctx: OrbitConfig['currentContext']) {
  config.set('currentContext', ctx);
}

export function clearToken() {
  config.delete('token');
}

export function clearAll() {
  config.clear();
}
