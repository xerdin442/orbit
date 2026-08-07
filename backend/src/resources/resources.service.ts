import {
  Injectable,
  NotFoundException,
  Inject,
  ConflictException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Queue } from 'bullmq';
import { DbService } from '@src/db/db.service';
import { DockerService } from '@src/infrastructure/docker.service';
import { ActivityService } from '@src/activity/activity.service';
import { RESOURCE_DEFAULTS } from './defaults';
import { ResourceDefaultKey } from '@src/common/types';
import { ActivityType, ResourceType, ResourceStatus } from '@generated/client';

@Injectable()
export class ResourcesService {
  constructor(
    private readonly db: DbService,
    private readonly docker: DockerService,
    private readonly activity: ActivityService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @InjectQueue('resources') private readonly resourceQueue: Queue,
  ) {}

  getDefaults(
    types: ResourceType[],
  ): Partial<Record<ResourceType, ResourceDefaultKey[]>> {
    const result: Partial<Record<ResourceType, ResourceDefaultKey[]>> = {};

    for (const type of types) {
      result[type] = RESOURCE_DEFAULTS[type];
    }

    return result;
  }

  async create(
    environmentId: string,
    userId: string,
    type: ResourceType,
    name: string,
    credentials?: Record<string, string>,
  ) {
    const env = await this.db.environment.findFirst({
      where: { id: environmentId, project: { ownerId: userId } },
    });

    if (!env) {
      throw new NotFoundException('Environment not found');
    }

    const resource = await this.db.resource.create({
      data: {
        type,
        name,
        status: ResourceStatus.provisioning,
        environmentId,
        credentials,
      },
    });

    await this.resourceQueue.add('provision', { resourceId: resource.id });

    await this.cache.del(`/api/environments/${environmentId}/resources`);

    return resource;
  }

  async findById(id: string, userId: string) {
    const resource = await this.db.resource.findFirst({
      where: { id, environment: { project: { ownerId: userId } } },
      include: { environment: { include: { project: true } } },
    });

    if (!resource) {
      throw new NotFoundException('Resource not found');
    }

    return resource;
  }

  async findByEnvironment(environmentId: string, userId: string) {
    return await this.db.resource.findMany({
      where: { environmentId, environment: { project: { ownerId: userId } } },
    });
  }

  async delete(id: string, userId: string) {
    const resource = await this.findById(id, userId);

    if (resource.containerId) {
      try {
        await this.docker.stopContainer(resource.containerId);
        await this.docker.removeContainer(resource.containerId);
      } catch {
        // container already gone
      }
    }

    if (resource.volumeId) {
      try {
        await this.docker.removeVolume(resource.volumeId);
      } catch {
        // volume already gone
      }
    }

    await this.db.resource.delete({ where: { id } });

    await this.activity.log(ActivityType.resource_deleted, userId, {
      resourceId: id,
      environmentId: resource.environmentId,
      type: resource.type,
    });

    await this.cache.del(`/api/resources/${id}`);
  }

  async clearData(id: string, userId: string) {
    const resource = await this.findById(id, userId);

    if (resource.status === ResourceStatus.provisioning) {
      throw new ConflictException('Resource is already being provisioned');
    }

    await this.db.resource.update({
      where: { id },
      data: { status: ResourceStatus.provisioning },
    });

    await this.resourceQueue.add('clear-data', { resourceId: id });

    return { resourceId: id, status: ResourceStatus.provisioning };
  }
}
