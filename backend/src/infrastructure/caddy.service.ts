import { Injectable } from '@nestjs/common';
import { Secrets } from '@src/common/secrets';
import { DbService } from '@src/db/db.service';
import { DockerService } from '@src/infrastructure/docker.service';
import { Logger } from '@src/common/logger';
import { DomainStatus } from '@generated/client';

@Injectable()
export class CaddyService {
  private readonly logger = Logger(CaddyService.name);
  private readonly adminUrl: string;

  constructor(
    private readonly db: DbService,
    private readonly docker: DockerService,
  ) {
    this.adminUrl = Secrets.CADDY_ADMIN_URL;
  }

  async syncEnvironment(environmentId: string) {
    const env = await this.db.environment.findUniqueOrThrow({
      where: { id: environmentId },
      include: { project: true },
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

    const network = await this.docker.getOrCreateProjectNetwork(env.project.id);
    try {
      await this.docker.connectContainerToNetwork(
        network.id,
        Secrets.CADDY_CONTAINER_NAME,
      );
    } catch {
      // Caddy is already connected to this network
    }

    const domains = await this.db.domain.findMany({
      where: {
        environmentId,
        status: DomainStatus.active,
      },
    });

    const container = await this.docker.inspectContainer(
      deployment.containerId,
    );
    const containerName = container.Name.replace(/^\//, '');

    for (const domain of domains) {
      const routeId = this.routeId(domain.hostname);
      const route = {
        '@id': routeId,
        match: [{ host: [domain.hostname] }],
        handle: [
          {
            handler: 'reverse_proxy',
            upstreams: [
              {
                dial: `${containerName}:${env.project.healthCheckPort}`,
              },
            ],
          },
        ],
      };

      await this.upsertRoute(routeId, route);
    }
  }

  private async upsertRoute(
    routeId: string,
    route: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.fetchCaddy(`/id/${routeId}`, 'PATCH', route);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (!/unknown object id/i.test(message)) {
        throw error;
      }

      await this.fetchCaddy(
        '/config/apps/http/servers/srv0/routes',
        'POST',
        route,
      );
    }
  }

  async enableAccessLogging(): Promise<void> {
    await this.fetchCaddy('/config/logging', 'POST', {
      logs: {
        default: {
          encoder: { format: 'json' },
          include: ['http.log.access'],
        },
      },
    });

    await this.fetchCaddy('/config/apps/http/servers/srv0/logs', 'POST', {});
  }

  private async fetchCaddy(path: string, method: string, body?: unknown) {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Origin: this.adminUrl,
      },
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
