import { SlackDeploymentEventsListener } from './deployment-events.listener';
import {
  DeploymentStatusChangedEvent,
  DeploymentCompletedEvent,
  DeploymentTerminatedEvent,
} from './deployment.events';
import { DeploymentTrigger, BuildStatus } from '@generated/client';

describe('SlackDeploymentEventsListener', () => {
  let listener: SlackDeploymentEventsListener;
  let slackApi: { enqueue: jest.Mock };

  const mockDeployment = {
    id: 'deployment-1',
    commitSha: 'abcdef1234567890',
    commitMessage: 'Initial commit',
    trigger: DeploymentTrigger.manual,
    completedAt: new Date('2026-07-31T12:01:30Z'),
  } as any;

  const mockProject = { id: 'project-1', name: 'my-project' } as any;
  const mockEnvironment = { id: 'env-1', name: 'production' } as any;

  const slackMetadata = {
    teamId: 'T123',
    channelId: 'C123',
    userId: 'U123',
    messageTs: '1234567890.123456',
    startedAt: new Date('2026-07-31T12:00:00Z').toISOString(),
  };

  beforeEach(() => {
    slackApi = { enqueue: jest.fn().mockResolvedValue(undefined) };
    listener = new SlackDeploymentEventsListener(slackApi as any);
  });

  it('updates the card on deployment.status.changed', async () => {
    await listener.handleStatusChanged(
      new DeploymentStatusChangedEvent(
        mockDeployment,
        mockProject,
        mockEnvironment,
        BuildStatus.building,
        slackMetadata,
      ),
    );

    expect(slackApi.enqueue).toHaveBeenCalledWith(
      'T123',
      'chat.update',
      expect.objectContaining({
        channel: 'C123',
        ts: '1234567890.123456',
        blocks: expect.any(Array),
        text: expect.stringContaining('Updated'),
      }),
    );
  });

  it('updates the card to success on deployment.completed for deploy', async () => {
    await listener.handleCompleted(
      new DeploymentCompletedEvent(
        mockDeployment,
        mockProject,
        mockEnvironment,
        'https://my-project.example.com',
        slackMetadata,
      ),
    );

    expect(slackApi.enqueue).toHaveBeenCalledWith(
      'T123',
      'chat.update',
      expect.objectContaining({
        channel: 'C123',
        ts: '1234567890.123456',
        blocks: expect.any(Array),
        text: 'Deployed: my-project (production)',
      }),
    );

    const args = slackApi.enqueue.mock.calls[0][2];
    const blocks = args.blocks;
    const header = blocks.find((b: any) => b.type === 'header');
    expect(header.text.text).toContain(':white_check_mark:');

    const actions = blocks.find((b: any) => b.type === 'actions');
    expect(actions.elements[0].url).toBe('https://my-project.example.com');
  });

  it('updates the card to rolled_back on deployment.completed for rollback', async () => {
    const rollbackDeployment = {
      ...mockDeployment,
      trigger: DeploymentTrigger.rollback,
    };

    await listener.handleCompleted(
      new DeploymentCompletedEvent(
        rollbackDeployment,
        mockProject,
        mockEnvironment,
        'https://my-project.example.com',
        slackMetadata,
      ),
    );

    const args = slackApi.enqueue.mock.calls[0][2];
    const blocks = args.blocks;
    const header = blocks.find((b: any) => b.type === 'header');
    expect(header.text.text).toContain(':arrow_backward:');
    expect(header.text.text).toContain('Rolled Back');
  });

  it('updates the card to failed on deployment.terminated', async () => {
    await listener.handleTerminated(
      new DeploymentTerminatedEvent(
        mockDeployment,
        mockProject,
        mockEnvironment,
        slackMetadata,
      ),
    );

    expect(slackApi.enqueue).toHaveBeenCalledWith(
      'T123',
      'chat.update',
      expect.objectContaining({
        text: 'Failed: my-project (production)',
      }),
    );

    const args = slackApi.enqueue.mock.calls[0][2];
    const header = args.blocks.find((b: any) => b.type === 'header');
    expect(header.text.text).toContain(':x:');
  });

  it('does nothing when slackMetadata.messageTs is missing', async () => {
    await listener.handleStatusChanged(
      new DeploymentStatusChangedEvent(
        mockDeployment,
        mockProject,
        mockEnvironment,
        BuildStatus.building,
        { ...slackMetadata, messageTs: '' },
      ),
    );

    expect(slackApi.enqueue).not.toHaveBeenCalled();
  });
});
