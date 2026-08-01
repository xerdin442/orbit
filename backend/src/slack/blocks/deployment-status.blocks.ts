import type { Block, KnownBlock } from '@slack/types';
import { BuildStatus } from '@generated/client';

interface StatusCardParams {
  project: string;
  environment: string;
  status:
    | 'queued'
    | 'building'
    | 'deploying'
    | 'success'
    | 'failed'
    | 'rolled_back'
    | 'no_deployments';
  url?: string;
  commitSha?: string;
  commitMessage?: string;
  startedAt?: string;
  duration?: string;
  triggeredBy?: string;
}

const STATUS_EMOJI: Record<StatusCardParams['status'], string> = {
  queued: ':hourglass_flowing_sand:',
  building: ':hammer_and_wrench:',
  deploying: ':rocket:',
  success: ':white_check_mark:',
  failed: ':x:',
  rolled_back: ':arrow_backward:',
  no_deployments: ':information_source:',
};

const STATUS_LABEL: Record<StatusCardParams['status'], string> = {
  queued: 'Queued',
  building: 'Building',
  deploying: 'Deploying',
  success: 'Deployed',
  failed: 'Failed',
  rolled_back: 'Rolled Back',
  no_deployments: 'No Deployments',
};

export const BUILD_STATUS_TO_CARD_STATUS: Record<
  BuildStatus,
  StatusCardParams['status']
> = {
  pending: 'queued',
  cloning: 'building',
  building: 'building',
  deploying: 'deploying',
  ready: 'success',
  failed: 'failed',
  aborted: 'failed',
};

export function formatDuration(startMs: number, endMs: number): string {
  const diff = Math.max(0, endMs - startMs);
  const seconds = Math.floor(diff / 1000) % 60;
  const minutes = Math.floor(diff / 60000) % 60;
  const hours = Math.floor(diff / 3600000);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

export function buildDeploymentStatusBlocks(
  params: StatusCardParams,
): (Block | KnownBlock)[] {
  const {
    project,
    environment,
    status,
    url,
    commitSha,
    commitMessage,
    startedAt,
    duration,
    triggeredBy,
  } = params;
  const emoji = STATUS_EMOJI[status];
  const label = STATUS_LABEL[status];

  const blocks: (Block | KnownBlock)[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${emoji} ${label}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Project:*\n${project}`,
        },
        {
          type: 'mrkdwn',
          text: `*Environment:*\n${environment}`,
        },
      ],
    },
  ];

  const contextElements: { type: 'mrkdwn'; text: string }[] = [];
  if (commitSha || commitMessage) {
    const parts: string[] = [];
    if (commitSha) {
      parts.push(`\`${commitSha.slice(0, 7)}\``);
    }
    if (commitMessage) {
      parts.push(commitMessage);
    }
    contextElements.push({
      type: 'mrkdwn',
      text: `:twisted_rightwards_arrows: ${parts.join(' ')}`,
    });
  }
  if (triggeredBy) {
    contextElements.push({
      type: 'mrkdwn',
      text: `:bust_in_silhouette: Triggered by <@${triggeredBy}>`,
    });
  }
  if (startedAt) {
    const date = new Date(startedAt);
    const timestamp = Math.floor(date.getTime() / 1000);
    contextElements.push({
      type: 'mrkdwn',
      text: `:calendar: *Started:* <!date^${timestamp}^{date_num} {time_secs}|${date.toLocaleString()}>`,
    });
  }
  if (duration) {
    contextElements.push({
      type: 'mrkdwn',
      text: `:stopwatch: *Duration:* ${duration}`,
    });
  }

  if (contextElements.length > 0) {
    blocks.push({
      type: 'context',
      elements: contextElements,
    });
  }

  if (url) {
    const actions: KnownBlock = {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Open Deployment',
            emoji: true,
          },
          style: 'primary',
          url,
        },
      ],
    };
    blocks.push(actions);
  }

  return blocks;
}
