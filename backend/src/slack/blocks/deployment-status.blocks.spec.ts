import {
  buildDeploymentStatusBlocks,
  formatDuration,
  BUILD_STATUS_TO_CARD_STATUS,
} from './deployment-status.blocks';
import { BuildStatus } from '@generated/client';

describe('buildDeploymentStatusBlocks', () => {
  it('renders a header and project/environment fields', () => {
    const blocks = buildDeploymentStatusBlocks({
      project: 'my-project',
      environment: 'production',
      status: 'queued',
    });

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({
      type: 'header',
      text: {
        type: 'plain_text',
        text: ':hourglass_flowing_sand: Queued',
      },
    });
    expect(blocks[1]).toMatchObject({
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: '*Project:*\nmy-project' },
        { type: 'mrkdwn', text: '*Environment:*\nproduction' },
      ],
    });
  });

  it('renders commit context when commit info is provided', () => {
    const blocks = buildDeploymentStatusBlocks({
      project: 'my-project',
      environment: 'production',
      status: 'success',
      commitSha: 'abcdef1234567890',
      commitMessage: 'Initial commit',
    });

    const context = blocks.find((b) => b.type === 'context');
    expect(context).toBeDefined();
    expect((context as any).elements[0].text).toBe(':twisted_rightwards_arrows: `abcdef1` Initial commit');
  });

  it('renders triggered by and started at context', () => {
    const startedAt = new Date('2026-07-31T12:00:00Z').toISOString();
    const blocks = buildDeploymentStatusBlocks({
      project: 'my-project',
      environment: 'production',
      status: 'building',
      triggeredBy: 'U123',
      startedAt,
    });

    const context = blocks.find((b) => b.type === 'context');
    expect(context).toBeDefined();
    const texts = (context as any).elements.map((e: any) => e.text);
    expect(texts[0]).toContain(':bust_in_silhouette:');
    expect(texts[0]).toContain('Triggered by <@U123>');
    expect(texts[1]).toContain(':calendar:');
    expect(texts[1]).toContain('Started');
  });

  it('renders duration when completedAt and startedAt are provided', () => {
    const startedAt = new Date('2026-07-31T12:00:00Z').toISOString();
    const blocks = buildDeploymentStatusBlocks({
      project: 'my-project',
      environment: 'production',
      status: 'success',
      startedAt,
      duration: '1m 30s',
    });

    const context = blocks.find((b) => b.type === 'context');
    expect(context).toBeDefined();
    expect((context as any).elements[1].text).toBe(':stopwatch: *Duration:* 1m 30s');
  });

  it('renders an Open Deployment button when url is provided', () => {
    const blocks = buildDeploymentStatusBlocks({
      project: 'my-project',
      environment: 'production',
      status: 'success',
      url: 'https://my-project.example.com',
    });

    const actions = blocks.find((b) => b.type === 'actions');
    expect(actions).toBeDefined();
    expect((actions as any).elements[0].url).toBe(
      'https://my-project.example.com',
    );
  });
});

describe('formatDuration', () => {
  it('formats seconds', () => {
    expect(formatDuration(0, 30_000)).toBe('30s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(0, 90_000)).toBe('1m 30s');
  });

  it('formats hours, minutes, and seconds', () => {
    expect(formatDuration(0, 3_661_000)).toBe('1h 1m 1s');
  });

  it('returns 0s for zero duration', () => {
    expect(formatDuration(100, 100)).toBe('0s');
  });
});

describe('BUILD_STATUS_TO_CARD_STATUS', () => {
  it('maps all build statuses to card statuses', () => {
    expect(BUILD_STATUS_TO_CARD_STATUS[BuildStatus.pending]).toBe('queued');
    expect(BUILD_STATUS_TO_CARD_STATUS[BuildStatus.cloning]).toBe('building');
    expect(BUILD_STATUS_TO_CARD_STATUS[BuildStatus.building]).toBe('building');
    expect(BUILD_STATUS_TO_CARD_STATUS[BuildStatus.deploying]).toBe(
      'deploying',
    );
    expect(BUILD_STATUS_TO_CARD_STATUS[BuildStatus.ready]).toBe('success');
    expect(BUILD_STATUS_TO_CARD_STATUS[BuildStatus.failed]).toBe('failed');
    expect(BUILD_STATUS_TO_CARD_STATUS[BuildStatus.aborted]).toBe('failed');
  });
});
