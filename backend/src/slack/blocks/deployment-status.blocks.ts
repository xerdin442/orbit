import type { Block, KnownBlock } from '@slack/types';

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

export function buildDeploymentStatusBlocks(
  params: StatusCardParams,
): (Block | KnownBlock)[] {
  const { project, environment, status, url, commitSha, commitMessage } =
    params;
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

  if (commitSha || commitMessage) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: [
            commitSha ? `\`${commitSha.slice(0, 7)}\`` : '',
            commitMessage ?? '',
          ]
            .filter(Boolean)
            .join(' — '),
        },
      ],
    });
  }

  if (url) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Open Deployment',
            emoji: true,
          },
          url,
        },
      ],
    });
  }

  return blocks;
}
