import { Injectable } from '@nestjs/common';
import { Secrets } from '@src/common/secrets';
import { Logger } from '@src/common/logger';

@Injectable()
export class CaddyService {
  private readonly logger = Logger(CaddyService.name);
  private readonly adminUrl: string;

  constructor() {
    this.adminUrl = Secrets.CADDY_ADMIN_URL;
  }

  async addRoute(hostname: string, containerId: string, port: number) {
    const routeId = this.routeId(hostname);

    await this.fetchCaddy(`/config/apps/http/servers/srv0/routes`, 'POST', {
      '@id': routeId,
      match: [{ host: [hostname] }],
      handle: [
        {
          handler: 'reverse_proxy',
          upstreams: [{ dial: `${containerId}:${port}` }],
        },
      ],
    });

    this.logger.info(
      `Caddy route added: ${hostname} -> ${containerId}:${port}`,
    );
  }

  async removeRoute(hostname: string) {
    const routeId = this.routeId(hostname);

    await this.fetchCaddy(`/id/${routeId}`, 'DELETE');

    this.logger.info(`Caddy route removed: ${hostname}`);
  }

  async updateRoute(hostname: string, containerId: string, port: number) {
    await this.addRoute(hostname, containerId, port);
  }

  async reload() {
    await this.fetchCaddy('/load', 'POST');
    this.logger.info('Caddy configuration reloaded');
  }

  private async fetchCaddy(path: string, method: string, body?: unknown) {
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.adminUrl}${path}`, options);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Caddy API error (${response.status}): ${errorBody}`);
    }
  }

  private routeId(hostname: string): string {
    return `orbit-route-${hostname.replace(/\./g, '-')}`;
  }
}
