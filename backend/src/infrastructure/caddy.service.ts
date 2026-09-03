import { Injectable, OnModuleInit } from '@nestjs/common';
import { Secrets } from '@src/common/secrets';
import { DbService } from '@src/db/db.service';
import { DockerService } from '@src/infrastructure/docker.service';
import { Logger } from '@src/common/logger';
import { DomainStatus } from '@generated/client';

const MANAGED_TLS_POLICY_ID = 'orbit-managed-internal-tls';

@Injectable()
export class CaddyService implements OnModuleInit {
  private readonly logger = Logger(CaddyService.name);
  private readonly adminUrl: string;

  constructor(
    private readonly db: DbService,
    private readonly docker: DockerService,
  ) {
    this.adminUrl = Secrets.CADDY_ADMIN_URL;
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureManagedTlsPolicy();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to configure managed-domain TLS policy: ${message}`,
      );
    }
  }

  private async ensureManagedTlsPolicy(): Promise<void> {
    if (!this.isPrivateAddress(Secrets.INGRESS_IP)) {
      return;
    }

    // Drop any stale copy first so re-runs don't stack duplicate policies.
    try {
      await this.fetchCaddy(`/id/${MANAGED_TLS_POLICY_ID}`, 'DELETE');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (!/unknown object id/i.test(message)) {
        throw error;
      }
    }

    await this.fetchCaddy('/config/apps/tls/automation/policies/0', 'PUT', {
      '@id': MANAGED_TLS_POLICY_ID,
      subjects: [`*.${Secrets.INGRESS_HOST}`],
      issuers: [{ module: 'internal' }],
      on_demand: true,
    });
  }

  private isPrivateAddress(ip: string): boolean {
    if (ip === 'localhost' || ip === '::1' || /^127\./.test(ip)) {
      return true;
    }

    if (/^10\./.test(ip) || /^192\.168\./.test(ip)) {
      return true;
    }

    const secondOctet = ip.match(/^172\.(\d{1,3})\./);
    if (secondOctet) {
      const octet = Number(secondOctet[1]);
      return octet >= 16 && octet <= 31;
    }

    return false;
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

    const upstreamHost = deployment.containerId.slice(0, 12);

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
                dial: `${upstreamHost}:${env.project.healthCheckPort}`,
              },
            ],
          },
        ],
      };

      await this.upsertRoute(domain.hostname, route);
    }
  }

  private async upsertRoute(
    hostname: string,
    route: Record<string, unknown>,
  ): Promise<void> {
    // Drop any existing copy first, then re-insert at the head of the route list
    await this.deleteRoute(hostname);

    await this.fetchCaddy(
      '/config/apps/http/servers/srv0/routes/0',
      'PUT',
      route,
    );
  }

  async deleteRoute(hostname: string): Promise<void> {
    const routeId = this.routeId(hostname);

    try {
      await this.fetchCaddy(`/id/${routeId}`, 'DELETE');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (!/unknown object id/i.test(message)) {
        throw error;
      }
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
