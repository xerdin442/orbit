import { SlackBoltService } from './slack-bolt.service';
import { App, SocketModeReceiver } from '@slack/bolt';
import type { Queue } from 'bullmq';
import type { RedisClientType } from 'redis';
import type { DbService } from '@src/db/db.service';
import type { ActivityService } from '@src/activity/activity.service';
import type { DeploymentsService } from '@src/deployments/deployments.service';
import type { SlackInstallationStore } from './slack-installation.store';
import type { SlackApiService } from './slack-api.service';
import type { DeploymentJob } from '@src/common/types';

const appMock = {
  use: jest.fn(),
  event: jest.fn(),
  command: jest.fn(),
  action: jest.fn(),
  start: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
};

const receiverMock = { key: 'socket-mode-receiver' };

jest.mock('@slack/bolt', () => {
  return {
    App: jest.fn(() => appMock),
    SocketModeReceiver: jest.fn(() => receiverMock),
  };
});

jest.mock('@slack/web-api', () => {
  return {
    WebClient: jest.fn(),
  };
});

const mockQueue = {
  add: jest.fn().mockResolvedValue(undefined),
};

const mockRedis = {
  incr: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(undefined),
};

const mockInstallationStore = {
  getRecord: jest.fn(),
  deleteInstallation: jest.fn(),
  storeInstallation: jest.fn(),
  storeInstallationData: jest.fn(),
  fetchInstallation: jest.fn(),
};

const mockSlackApi = {
  call: jest.fn().mockResolvedValue(undefined),
  enqueue: jest.fn().mockResolvedValue(undefined),
  invalidateClient: jest.fn(),
};

const mockActivity = {
  log: jest.fn().mockResolvedValue(undefined),
};

const mockDb = {
  project: { findFirst: jest.fn() },
  environment: { findFirst: jest.fn() },
  deployment: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  slackInstallation: { update: jest.fn() },
};

const mockDeployments = {
  createDeployment: jest.fn(),
  findForRollback: jest.fn(),
  findById: jest.fn(),
  updateBuildStatus: jest.fn(),
  markCompleted: jest.fn(),
  markFailed: jest.fn(),
};

describe('SlackBoltService', () => {
  let service: SlackBoltService;

  beforeEach(() => {
    jest.clearAllMocks();
    (App as unknown as jest.Mock).mockImplementation(() => appMock);
    (SocketModeReceiver as unknown as jest.Mock).mockImplementation(
      () => receiverMock,
    );

    service = new SlackBoltService(
      mockInstallationStore as unknown as SlackInstallationStore,
      mockSlackApi as unknown as SlackApiService,
      mockActivity as unknown as ActivityService,
      mockDb as unknown as DbService,
      mockDeployments as unknown as DeploymentsService,
      mockRedis as unknown as RedisClientType,
      mockQueue as unknown as Queue<DeploymentJob>,
    );
  });

  it('creates a Socket Mode App backed by a SocketModeReceiver', () => {
    expect(SocketModeReceiver).toHaveBeenCalledWith(
      expect.objectContaining({
        appToken: 'xapp-test-app-token',
        clientPingTimeout: 30_000,
      }),
    );
    expect(App).toHaveBeenCalledWith(
      expect.objectContaining({
        socketMode: true,
        receiver: receiverMock,
        authorize: expect.any(Function),
      }),
    );
    expect(service.app).toBeDefined();
  });

  it('opens the Socket Mode connection on module init and closes it on destroy', async () => {
    await service.onModuleInit();
    expect(appMock.start).toHaveBeenCalledTimes(1);

    await service.onModuleDestroy();
    expect(appMock.stop).toHaveBeenCalledTimes(1);
  });

  it('registers middleware, lifecycle events, commands, and actions', () => {
    expect(service.app.use).toHaveBeenCalledTimes(2);
    expect(service.app.event).toHaveBeenCalledTimes(2);
    expect(service.app.command).toHaveBeenCalledTimes(4);
    expect(service.app.action).toHaveBeenCalledTimes(2);
  });

  describe('authorize', () => {
    it('resolves bot credentials via the installation store', async () => {
      const authorizeFn = (App as unknown as jest.Mock).mock.calls[0][0]
        .authorize as (source: {
        teamId: string;
        enterpriseId?: string;
        isEnterpriseInstall: boolean;
      }) => Promise<Record<string, unknown>>;

      mockInstallationStore.fetchInstallation.mockResolvedValue({
        bot: { token: 'xoxb-token', id: 'B1', userId: 'U-BOT' },
        team: { id: 'T1' },
        enterprise: undefined,
      });

      const result = await authorizeFn({
        teamId: 'T1',
        enterpriseId: undefined,
        isEnterpriseInstall: false,
      });

      expect(mockInstallationStore.fetchInstallation).toHaveBeenCalledWith({
        teamId: 'T1',
        enterpriseId: undefined,
        isEnterpriseInstall: false,
      });
      expect(result).toEqual({
        botToken: 'xoxb-token',
        botId: 'B1',
        botUserId: 'U-BOT',
        teamId: 'T1',
        enterpriseId: undefined,
      });
    });
  });

  const actionHandler = (id: string) => {
    const call = (appMock.action.mock.calls as [string, unknown][]).find(
      ([actionId]) => actionId === id,
    );
    if (!call) throw new Error(`no handler registered for action "${id}"`);
    return call[1] as (args: {
      ack: jest.Mock;
      action: { value?: string };
      respond: jest.Mock;
    }) => Promise<void>;
  };

  const confirmMetadata = {
    teamId: 'T1',
    channelId: 'C1',
    userId: 'U1',
    projectId: 'p1',
    projectName: 'api',
    environmentId: 'e1',
    environmentName: 'production',
    action: 'deploy' as 'deploy' | 'rollback',
  };

  describe('deploy_confirm action', () => {
    let ack: jest.Mock;
    let respond: jest.Mock;

    beforeEach(() => {
      ack = jest.fn().mockResolvedValue(undefined);
      respond = jest.fn().mockResolvedValue(undefined);
      mockInstallationStore.getRecord.mockResolvedValue({
        id: 'inst-1',
        userId: 'owner-1',
      });
      mockSlackApi.call.mockResolvedValue({ ts: '1700000000.000100' });
      mockDeployments.createDeployment.mockResolvedValue({ id: 'dep-1' });
      mockDeployments.findForRollback.mockResolvedValue({ id: 'rb-1' });
    });

    it('acks, posts the status card, creates a deployment, and enqueues the job', async () => {
      await actionHandler('deploy_confirm')({
        ack,
        action: { value: JSON.stringify(confirmMetadata) },
        respond,
      });

      expect(ack).toHaveBeenCalledTimes(1);
      expect(mockSlackApi.call).toHaveBeenCalledWith(
        'T1',
        'chat.postMessage',
        expect.objectContaining({ channel: 'C1' }),
      );
      expect(mockDeployments.createDeployment).toHaveBeenCalledWith(
        'e1',
        'owner-1',
      );
      expect(mockQueue.add).toHaveBeenCalledWith(
        'deploy',
        expect.objectContaining({
          deployment: { id: 'dep-1' },
          slackMetadata: expect.objectContaining({
            teamId: 'T1',
            channelId: 'C1',
            userId: 'U1',
            messageTs: '1700000000.000100',
          }),
        }),
      );
      expect(respond).toHaveBeenLastCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Deployment queued'),
          replace_original: true,
        }),
      );
    });

    it('ignores an action with no value', async () => {
      await actionHandler('deploy_confirm')({ ack, action: {}, respond });

      expect(ack).toHaveBeenCalledTimes(1);
      expect(mockSlackApi.call).not.toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('replaces the prompt when the installation record is gone', async () => {
      mockInstallationStore.getRecord.mockResolvedValue(null);

      await actionHandler('deploy_confirm')({
        ack,
        action: { value: JSON.stringify(confirmMetadata) },
        respond,
      });

      expect(mockDeployments.createDeployment).not.toHaveBeenCalled();
      expect(respond).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('No linked Orbit account'),
          replace_original: true,
        }),
      );
    });

    it('reports when the status card cannot be posted', async () => {
      mockSlackApi.call.mockRejectedValue(new Error('channel_not_found'));

      await actionHandler('deploy_confirm')({
        ack,
        action: { value: JSON.stringify(confirmMetadata) },
        respond,
      });

      expect(mockDeployments.createDeployment).not.toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
      expect(respond).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('could not be displayed'),
          replace_original: true,
        }),
      );
    });

    it('enqueues a rollback against the previous ready deployment', async () => {
      mockDb.deployment.findFirst.mockResolvedValue({ id: 'prev-1' });

      await actionHandler('deploy_confirm')({
        ack,
        action: {
          value: JSON.stringify({ ...confirmMetadata, action: 'rollback' }),
        },
        respond,
      });

      expect(mockDeployments.findForRollback).toHaveBeenCalledWith(
        'prev-1',
        'owner-1',
      );
      expect(mockQueue.add).toHaveBeenCalledWith(
        'rollback',
        expect.objectContaining({
          deployment: { id: 'rb-1' },
          skipImageBuild: true,
        }),
      );
      expect(respond).toHaveBeenLastCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Rollback queued'),
          replace_original: true,
        }),
      );
    });

    it('reports when there is nothing to roll back to', async () => {
      mockDb.deployment.findFirst.mockResolvedValue(null);

      await actionHandler('deploy_confirm')({
        ack,
        action: {
          value: JSON.stringify({ ...confirmMetadata, action: 'rollback' }),
        },
        respond,
      });

      expect(mockDeployments.findForRollback).not.toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
      expect(respond).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('No previous successful deployment'),
          replace_original: true,
        }),
      );
    });
  });

  describe('deploy_cancel action', () => {
    it('replaces the prompt with a cancellation notice', async () => {
      const ack = jest.fn().mockResolvedValue(undefined);
      const respond = jest.fn().mockResolvedValue(undefined);

      await actionHandler('deploy_cancel')({
        ack,
        action: { value: 'rollback' },
        respond,
      });

      expect(ack).toHaveBeenCalledTimes(1);
      expect(respond).toHaveBeenCalledWith({
        text: 'Rollback cancelled.',
        replace_original: true,
      });
    });

    it('ignores an action with no value', async () => {
      const ack = jest.fn().mockResolvedValue(undefined);
      const respond = jest.fn().mockResolvedValue(undefined);

      await actionHandler('deploy_cancel')({ ack, action: {}, respond });

      expect(ack).toHaveBeenCalledTimes(1);
      expect(respond).not.toHaveBeenCalled();
    });
  });
});
