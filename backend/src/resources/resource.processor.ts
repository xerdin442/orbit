import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { randomBytes } from 'crypto';
import { Logger } from '@src/common/logger';
import { DbService } from '@src/db/db.service';
import { DockerService } from '@src/infrastructure/docker.service';
import { ActivityService } from '@src/activity/activity.service';
import { Secrets } from '@src/common/secrets';
import { ActivityType, ResourceType, ResourceStatus } from '@generated/client';
import { ResourceJob } from '@src/common/types';

const IMAGE_MAP: Record<ResourceType, string> = {
  postgres: Secrets.POSTGRES_IMAGE_TAG,
  mysql: Secrets.MYSQL_IMAGE_TAG,
  redis: Secrets.REDIS_IMAGE_TAG,
  mongo: Secrets.MONGO_IMAGE_TAG,
};

const INTERNAL_PORT: Record<ResourceType, number> = {
  postgres: 5432,
  mysql: 3306,
  redis: 6379,
  mongo: 27017,
};

const MOUNT_PATH: Record<ResourceType, string> = {
  postgres: '/var/lib/postgresql/data',
  mysql: '/var/lib/mysql',
  redis: '/data',
  mongo: '/data/db',
};

const SECOND_NS = 1_000_000_000;

const HEALTHCHECK_TEST: Record<ResourceType, string[]> = {
  postgres: ['CMD', 'pg_isready', '-U', 'orbit', '-d', 'orbit', '-q'],
  mysql: ['CMD', 'mysqladmin', 'ping', '-h', '127.0.0.1'],
  redis: ['CMD', 'redis-cli', 'ping'],
  mongo: ['CMD', 'mongosh', '--quiet', '--eval', 'db.adminCommand("ping").ok'],
};

@Processor('resources')
export class ResourceProcessor extends WorkerHost {
  private readonly logger = Logger(ResourceProcessor.name);

  constructor(
    private readonly db: DbService,
    private readonly docker: DockerService,
    private readonly activity: ActivityService,
  ) {
    super();
  }

  async process(job: Job<ResourceJob>): Promise<void> {
    const { resourceId } = job.data;

    if (job.name === 'clear-data') {
      return this.clearData(resourceId);
    }

    const resource = await this.db.resource.findUniqueOrThrow({
      where: { id: resourceId },
      include: { environment: true },
    });

    try {
      const volumeName = `resource-${resourceId}-data`;
      const volume = await this.docker.createVolume(volumeName);

      await this.db.resource.update({
        where: { id: resourceId },
        data: { volumeId: volume.Name },
      });

      const containerName = `resource-${resourceId}`;
      const image = IMAGE_MAP[resource.type];
      const port = INTERNAL_PORT[resource.type];
      const password = randomBytes(16).toString('hex');

      const envVars = this.buildEnvVars(resource.type, password);

      const container = await this.docker.createContainer({
        name: containerName,
        Image: image,
        Env: envVars,
        Cmd: this.buildCommand(resource.type, password),
        Healthcheck: {
          Test: HEALTHCHECK_TEST[resource.type],
          Interval: 15 * SECOND_NS,
          Timeout: 30 * SECOND_NS,
          Retries: 10,
          StartPeriod: 40 * SECOND_NS,
        },
        HostConfig: {
          Binds: [`${volumeName}:${MOUNT_PATH[resource.type]}`],
          RestartPolicy: { Name: 'unless-stopped' },
        },
        Labels: {
          resource: resourceId,
          environment: resource.environmentId,
          project: resource.environment.projectId,
          'managed-by': 'orbit',
        },
      });

      await this.docker.startContainer(container.id);

      await this.db.resource.update({
        where: { id: resourceId },
        data: { containerId: container.id },
      });

      const healthy = await this.waitForHealth(container.id);

      if (!healthy) {
        throw new Error('Resource health check failed');
      }

      const credentials = this.buildCredentials(
        resource,
        containerName,
        port,
        password,
      );

      await this.db.resource.update({
        where: { id: resourceId },
        data: {
          status: ResourceStatus.ready,
          hostname: containerName,
          credentials,
        },
      });

      const env = await this.db.environment.findUniqueOrThrow({
        where: { id: resource.environmentId },
        include: { project: true },
      });

      await this.activity.log(
        ActivityType.resource_provisioned,
        env.project.ownerId,
        {
          resourceId,
          type: resource.type,
          environmentId: resource.environmentId,
        },
      );
    } catch (error) {
      this.logger.error(
        `Resource provisioning failed: ${resourceId} - ${error instanceof Error ? error.message : String(error)}`,
      );

      await this.db.resource.update({
        where: { id: resourceId },
        data: { status: ResourceStatus.failed },
      });
    }
  }

  private buildEnvVars(type: ResourceType, password: string): string[] {
    switch (type) {
      case ResourceType.postgres:
        return [
          'POSTGRES_USER=orbit',
          `POSTGRES_PASSWORD=${password}`,
          'POSTGRES_DB=orbit',
        ];
      case ResourceType.mysql:
        return [
          `MYSQL_ROOT_PASSWORD=${password}`,
          'MYSQL_USER=orbit',
          `MYSQL_PASSWORD=${password}`,
          'MYSQL_DATABASE=orbit',
        ];
      case ResourceType.redis:
        return [`REDISCLI_AUTH=${password}`];
      case ResourceType.mongo:
        return [
          'MONGO_INITDB_ROOT_USERNAME=orbit',
          `MONGO_INITDB_ROOT_PASSWORD=${password}`,
          'MONGO_INITDB_DATABASE=orbit',
        ];
    }
  }

  private buildCommand(
    type: ResourceType,
    password?: string,
  ): string[] | undefined {
    if (password && type === ResourceType.redis) {
      return ['redis-server', '--requirepass', password];
    }

    return undefined;
  }

  private buildCredentials(
    resource: { type: ResourceType; credentials: unknown },
    containerName: string,
    port: number,
    password: string,
  ): Record<string, string> {
    const template = resource.credentials as Record<string, string>;
    const result: Record<string, string> = {};

    for (const key of Object.keys(template)) {
      const upperKey = key.toUpperCase();

      if (upperKey.includes('URL') || upperKey.includes('URI')) {
        result[key] = this.buildUrl(
          resource.type,
          containerName,
          port,
          password,
        );
      } else if (upperKey.includes('HOST')) {
        result[key] = containerName;
      } else if (upperKey.includes('PORT')) {
        result[key] = String(port);
      } else if (
        upperKey.includes('PASSWORD') ||
        upperKey.includes('ROOT_PASSWORD')
      ) {
        result[key] = password;
      } else if (upperKey.includes('USER')) {
        result[key] = 'orbit';
      } else if (upperKey.includes('DATABASE') || upperKey.includes('NAME')) {
        result[key] = 'orbit';
      } else {
        result[key] = '';
      }
    }

    return result;
  }

  private buildUrl(
    type: ResourceType,
    host: string,
    port: number,
    password: string,
  ): string {
    switch (type) {
      case ResourceType.postgres:
        return `postgres://orbit:${password}@${host}:${port}/orbit`;
      case ResourceType.mysql:
        return `mysql://orbit:${password}@${host}:${port}/orbit`;
      case ResourceType.redis:
        return `redis://:${password}@${host}:${port}`;
      case ResourceType.mongo:
        return `mongodb://orbit:${password}@${host}:${port}/orbit`;
    }
  }

  private async clearData(resourceId: string): Promise<void> {
    const resource = await this.db.resource.findUniqueOrThrow({
      where: { id: resourceId },
      include: { environment: true },
    });

    const containerId = resource.containerId;
    const oldVolumeId = resource.volumeId;

    try {
      if (containerId) {
        try {
          await this.docker.stopContainer(containerId);
        } catch {
          // container already stopped
        }
      }

      if (oldVolumeId) {
        try {
          await this.docker.removeVolume(oldVolumeId);
        } catch {
          // volume already gone
        }
      }

      const volumeName = `resource-${resourceId}-data`;
      const volume = await this.docker.createVolume(volumeName);

      await this.db.resource.update({
        where: { id: resourceId },
        data: { volumeId: volume.Name },
      });

      if (containerId) {
        await this.docker.startContainer(containerId);

        const healthy = await this.waitForHealth(containerId);

        if (!healthy) {
          throw new Error('Resource health check failed');
        }
      }

      await this.db.resource.update({
        where: { id: resourceId },
        data: { status: ResourceStatus.ready },
      });

      const env = await this.db.environment.findUniqueOrThrow({
        where: { id: resource.environmentId },
        include: { project: true },
      });

      await this.activity.log(
        ActivityType.resource_data_cleared,
        env.project.ownerId,
        {
          resourceId,
          type: resource.type,
          environmentId: resource.environmentId,
        },
      );
    } catch (error) {
      this.logger.error(
        `Resource data clear failed: ${resourceId} - ${error instanceof Error ? error.message : String(error)}`,
      );

      await this.db.resource.update({
        where: { id: resourceId },
        data: { status: ResourceStatus.failed },
      });
    }
  }

  private async waitForHealth(containerId: string): Promise<boolean> {
    const deadline = Date.now() + 180_000;

    while (Date.now() < deadline) {
      try {
        const container = await this.docker.inspectContainer(containerId);
        const state = container.State;

        if (state.Status === 'running' && state.Health?.Status === 'healthy') {
          return true;
        }

        if (state.Status === 'exited' || state.Status === 'dead') {
          return false;
        }
      } catch {
        // not ready yet
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    return false;
  }
}
