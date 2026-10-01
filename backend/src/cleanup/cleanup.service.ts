import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { DbService } from '@src/db/db.service';
import type { CleanupJob } from '@src/common/types';

@Injectable()
export class CleanupService {
  constructor(
    private readonly db: DbService,
    @InjectQueue('cleanup') private readonly cleanupQueue: Queue<CleanupJob>,
  ) {}

  async enqueueProjectCleanup(projectId: string): Promise<void> {
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

    await this.cleanupQueue.add({
      projectId,
      deploymentContainerIds,
      resourceContainers,
      networkName: `project-${projectId}-network`,
    });
  }

  async enqueueEnvironmentCleanup(environmentId: string): Promise<void> {
    const env = await this.db.environment.findUnique({
      where: { id: environmentId },
      include: {
        deployments: { where: { containerId: { not: null } } },
        resources: {
          where: {
            OR: [{ containerId: { not: null } }, { volumeId: { not: null } }],
          },
        },
      },
    });

    if (!env) return;

    const deploymentContainerIds = env.deployments
      .map((d) => d.containerId)
      .filter((id): id is string => !!id);

    const resourceContainers = env.resources.map((r) => ({
      containerId: r.containerId ?? undefined,
      volumeId: r.volumeId ?? undefined,
    }));

    await this.cleanupQueue.add({
      environmentId,
      deploymentContainerIds,
      resourceContainers,
    });
  }
}
