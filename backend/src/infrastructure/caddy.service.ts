import { Injectable } from '@nestjs/common';
import { Secrets } from '@src/common/secrets';
import { DbService } from '@src/db/db.service';
import { Logger } from '@src/common/logger';
import { DomainStatus } from '@generated/client';

@Injectable()
export class CaddyService {
  private readonly logger = Logger(CaddyService.name);
  private readonly adminUrl: string;

  constructor(private readonly db: DbService) {
    this.adminUrl = Secrets.CADDY_ADMIN_URL;
  }

  async syncEnvironment(environmentId: string) {
    const env = await this.db.environment.findUniqueOrThrow({
      where: { id: environmentId },
    });

    if (!env.currentDeploymentId) {
      this.logger.info(`No active deployment for environment ${environmentId}`);
      return;
    }

    const deployment = await this.db.deployment.findUniqueOrThrow({
      where: { id: env.currentDeploymentId },
    });

    if (!deployment.containerId) {
      this.logger.info(
        `No container for deployment ${env.currentDeploymentId}`,
      );
      return;
    }

    const domains = await this.db.domain.findMany({
      where: {
        environmentId,
        status: DomainStatus.active,
      },
    });

    for (const domain of domains) {
      const route = {
        '@id': this.routeId(domain.hostname),
        match: [{ host: [domain.hostname] }],
        handle: [
          {
            handler: 'reverse_proxy',
            upstreams: [{ dial: `${deployment.containerId}:3000` }],
          },
        ],
      };

      await this.fetchCaddy(
        `/id/${this.routeId(domain.hostname)}`,
        'POST',
        route,
      );
    }
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
