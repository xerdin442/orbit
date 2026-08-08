import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { DbService } from '@src/db/db.service';
import type { CleanupJob } from '@src/common/types';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { ActivityService } from '@src/activity/activity.service';
import { ActivityType } from '@generated/client';

@Injectable()
export class CleanupService {
  constructor(
    private readonly db: DbService,
    private readonly activity: ActivityService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @InjectQueue('cleanup') private readonly cleanupQueue: Queue<CleanupJob>,
  ) {}

  async enqueueProjectCleanup(
    projectId: string,
    ownerId: string,
  ): Promise<void> {
    const project = await this.db.project.findFirst({
      where: { id: projectId, ownerId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const environments = await this.db.environment.findMany({
      where: { projectId },
      include: {
        deployments: { where: { containerId: { not: null } } },
        resources: {
          where: {
            OR: [{ containerId: { not: null } }, { volumeId: { not: null } }],
          },
        },
      },
    });

    const deploymentContainerIds: string[] = [];
    const resourceContainers: { containerId?: string; volumeId?: string }[] =
      [];

    for (const env of environments) {
      for (const deployment of env.deployments) {
        if (deployment.containerId) {
          deploymentContainerIds.push(deployment.containerId);
        }
      }

      for (const resource of env.resources) {
        resourceContainers.push({
          containerId: resource.containerId ?? undefined,
          volumeId: resource.volumeId ?? undefined,
        });
      }
    }

    await this.db.project.delete({ where: { id: projectId } });

    await this.activity.log(ActivityType.project_deleted, ownerId, {
      projectId,
    });

    await this.cache.del(`/api/projects/${projectId}`);
    await this.cache.del(`/api/projects/${projectId}/environments`);

    await this.cleanupQueue.add('project-cleanup', {
      projectId,
      deploymentContainerIds,
      resourceContainers,
      networkName: `project-${projectId}-network`,
    });
  }

  async enqueueEnvironmentCleanup(
    environmentId: string,
    ownerId: string,
  ): Promise<void> {
    const env = await this.db.environment.findUnique({
      where: { id: environmentId },
      include: {
        project: true,
        deployments: { where: { containerId: { not: null } } },
        resources: {
          where: {
            OR: [{ containerId: { not: null } }, { volumeId: { not: null } }],
          },
        },
      },
    });

    if (!env || env.project.ownerId !== ownerId) {
      throw new NotFoundException('Environment not found');
    }

    const deploymentContainerIds = env.deployments
      .map((d) => d.containerId)
      .filter((id): id is string => !!id);

    const resourceContainers = env.resources.map((r) => ({
      containerId: r.containerId ?? undefined,
      volumeId: r.volumeId ?? undefined,
    }));

    await this.db.environment.delete({ where: { id: env.id } });

    await this.cache.del(
      `/api/projects/${env.projectId}/environments/${env.id}`,
    );

    await this.activity.log(
      ActivityType.environment_deleted,
      env.project.ownerId,
      {
        projectId: env.projectId,
        environmentId: env.id,
      },
    );

    await this.cleanupQueue.add('environment-cleanup', {
      environmentId,
      deploymentContainerIds,
      resourceContainers,
    });
  }
}
