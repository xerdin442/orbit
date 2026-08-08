import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { Logger } from '@src/common/logger';
import { DockerService } from '@src/infrastructure/docker.service';
import type { CleanupJob } from '@src/common/types';

@Processor('cleanup')
export class CleanupProcessor extends WorkerHost {
  private readonly logger = Logger(CleanupProcessor.name);

  constructor(private readonly docker: DockerService) {
    super();
  }

  async process(job: Job<CleanupJob>): Promise<void> {
    const {
      projectId,
      environmentId,
      deploymentContainerIds,
      resourceContainers,
      networkName,
    } = job.data;

    this.logger.info(
      `Starting cleanup for ${projectId ? `project ${projectId}` : `environment ${environmentId}`}`,
    );

    for (const containerId of deploymentContainerIds) {
      await this.stopAndRemoveContainer(containerId);
    }

    for (const resource of resourceContainers) {
      if (resource.containerId) {
        await this.stopAndRemoveContainer(resource.containerId);
      }
      if (resource.volumeId) {
        try {
          await this.docker.removeVolume(resource.volumeId);
        } catch {
          // volume already removed
        }
      }
    }

    if (networkName) {
      try {
        await this.docker.removeNetwork(networkName);
      } catch {
        // network already removed
      }
    }

    this.logger.info(
      `Cleanup complete for ${projectId ? `project ${projectId}` : `environment ${environmentId}`}`,
    );
  }

  private async stopAndRemoveContainer(containerId: string): Promise<void> {
    try {
      await this.docker.stopContainer(containerId);
    } catch {
      // container already stopped or removed
    }

    try {
      await this.docker.removeContainer(containerId);
    } catch {
      // container already removed
    }
  }
}
