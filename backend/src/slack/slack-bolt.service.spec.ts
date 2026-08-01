import { SlackBoltService } from './slack-bolt.service';
import { App, ExpressReceiver } from '@slack/bolt';

const appMock = {
  use: jest.fn(),
  event: jest.fn(),
  command: jest.fn(),
  view: jest.fn(),
  init: jest.fn().mockResolvedValue(undefined),
};

jest.mock('@slack/bolt', () => {
  return {
    App: jest.fn(() => appMock),
    ExpressReceiver: jest.fn().mockImplementation(() => ({
      router: { use: jest.fn() },
    })),
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

    service = new SlackBoltService(
      mockInstallationStore as any,
      mockSlackApi as any,
      mockActivity as any,
      mockDb as any,
      mockDeployments as any,
      mockRedis as any,
      mockQueue as any,
    );
  });

  it('creates an ExpressReceiver and App', () => {
    expect(ExpressReceiver).toHaveBeenCalledWith(
      expect.objectContaining({
        signingSecret: 'test-slack-signing-secret',
        processBeforeResponse: true,
        installationStore: mockInstallationStore,
      }),
    );
    expect(App).toHaveBeenCalledWith(
      expect.objectContaining({
        receiver: expect.anything(),
      }),
    );
    expect(service.receiver).toBeDefined();
    expect(service.app).toBeDefined();
  });

  it('registers middleware, lifecycle events, commands, and view submissions', () => {
    expect(service.app.use).toHaveBeenCalledTimes(2);
    expect(service.app.event).toHaveBeenCalledTimes(2);
    expect(service.app.command).toHaveBeenCalledTimes(4);
    expect(service.app.view).toHaveBeenCalledTimes(1);
  });

  it('initializes the app on module init', async () => {
    await service.onModuleInit();
    expect(service.app.init).toHaveBeenCalled();
  });
});
