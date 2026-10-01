import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DeploymentTrigger } from '@generated/client';
import { SlackApiService } from '../slack-api.service';
import {
  buildDeploymentStatusBlocks,
  BUILD_STATUS_TO_CARD_STATUS,
  formatDuration,
} from '../blocks/deployment-status.blocks';
import type { DeploymentJob } from '@src/common/types';
import {
  DeploymentStatusChangedEvent,
  DeploymentCompletedEvent,
  DeploymentTerminatedEvent,
} from './deployment.events';

@Injectable()
export class SlackDeploymentEventsListener {
  constructor(private readonly slackApi: SlackApiService) {}

  @OnEvent('deployment.status.changed')
  async handleStatusChanged(
    event: DeploymentStatusChangedEvent,
  ): Promise<void> {
    const { deployment, project, environment, status, slackMetadata } = event;
    await this.updateCard(slackMetadata, project.name, environment.name, {
      status: BUILD_STATUS_TO_CARD_STATUS[status],
      startedAt: slackMetadata?.startedAt,
      commitSha: deployment.commitSha,
      commitMessage: deployment.commitMessage ?? undefined,
    });
  }

  @OnEvent('deployment.completed')
  async handleCompleted(event: DeploymentCompletedEvent): Promise<void> {
    const { deployment, project, environment, domain, slackMetadata } = event;

    await this.updateCard(slackMetadata, project.name, environment.name, {
      status:
        deployment.trigger === DeploymentTrigger.rollback
          ? 'rolled_back'
          : 'success',
      url: domain,
      startedAt: slackMetadata?.startedAt,
      completedAt: deployment.completedAt ?? new Date(),
      commitSha: deployment.commitSha,
      commitMessage: deployment.commitMessage ?? undefined,
    });
  }

  @OnEvent('deployment.terminated')
  async handleTerminated(event: DeploymentTerminatedEvent): Promise<void> {
    const { deployment, project, environment, slackMetadata } = event;
    await this.updateCard(slackMetadata, project.name, environment.name, {
      status: 'failed',
      startedAt: slackMetadata?.startedAt,
      completedAt: deployment.completedAt ?? new Date(),
      commitSha: deployment.commitSha,
      commitMessage: deployment.commitMessage ?? undefined,
    });
  }

  private async updateCard(
    metadata: DeploymentJob['slackMetadata'],
    project: string,
    environment: string,
    options: {
      status: Parameters<typeof buildDeploymentStatusBlocks>[0]['status'];
      url?: string;
      startedAt?: string;
      completedAt?: Date;
      commitSha?: string;
      commitMessage?: string;
    },
  ): Promise<void> {
    if (!metadata?.messageTs) return;

    const duration =
      options.startedAt && options.completedAt
        ? formatDuration(
            new Date(options.startedAt).getTime(),
            options.completedAt.getTime(),
          )
        : undefined;

    try {
      const blocks = buildDeploymentStatusBlocks({
        project,
        environment,
        status: options.status,
        url: options.url,
        startedAt: options.startedAt,
        duration,
        commitSha: options.commitSha,
        commitMessage: options.commitMessage,
      });

      await this.slackApi.enqueue(metadata.teamId, 'chat.update', {
        channel: metadata.channelId,
        ts: metadata.messageTs,
        blocks,
        text: `${options.status === 'success' || options.status === 'rolled_back' ? 'Deployed' : options.status === 'failed' ? 'Failed' : 'Updated'}: ${project} (${environment})`,
      });
    } catch {
      // enqueue failure is logged by the slack-api processor
    }
  }
}
