import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
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
    type: ResourceType,
    name: string,
    credentials?: Record<string, string>,
  ) {
    const env = await this.db.environment.findUnique({
      where: { id: environmentId },
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
        credentials: credentials ?? {},
      },
    });

    await this.resourceQueue.add({ resourceId: resource.id });

    return resource;
  }

  async findById(id: string) {
    const resource = await this.db.resource.findUnique({
      where: { id },
    });

    if (!resource) {
      throw new NotFoundException('Resource not found');
    }

    return resource;
  }

  async delete(id: string, userId: string) {
    const resource = await this.findById(id);

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
  }
}
