import { SlackApiService } from './slack-api.service';
import { WebClient } from '@slack/web-api';
import { DbService } from '@src/db/db.service';
import { EncryptionService } from '@src/infrastructure/encryption.service';

jest.mock('@slack/web-api', () => ({
  WebClient: jest.fn(),
}));

describe('SlackApiService', () => {
  let service: SlackApiService;
  let db: jest.Mocked<Pick<DbService, 'slackInstallation'>>;
  let encryption: jest.Mocked<Pick<EncryptionService, 'encrypt' | 'decrypt'>>;
  let queue: { add: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    (WebClient as unknown as jest.Mock).mockImplementation(() => ({
      apiCall: jest.fn().mockResolvedValue({ ok: true }),
    }));

    db = {
      slackInstallation: {
        findFirst: jest.fn(),
      },
    } as unknown as jest.Mocked<Pick<DbService, 'slackInstallation'>>;

    encryption = {
      encrypt: jest.fn((v: string) => `encrypted:${v}`),
      decrypt: jest.fn((v: string) => v.replace('encrypted:', '')),
    };

    queue = { add: jest.fn().mockResolvedValue(undefined) };

    service = new SlackApiService(
      db as unknown as DbService,
      encryption as unknown as EncryptionService,
      queue as any,
    );
  });

  it('fetches installation, decrypts token, and calls Slack API', async () => {
    db.slackInstallation.findFirst.mockResolvedValue({
      teamId: 'T123',
      botToken: 'encrypted:xoxb-token',
      isActive: true,
    } as any);

    await service.call('T123', 'chat.postMessage', {
      channel: 'C123',
      text: 'hello',
    });

    expect(db.slackInstallation.findFirst).toHaveBeenCalledWith({
      where: { teamId: 'T123', isActive: true },
    });
    expect(encryption.decrypt).toHaveBeenCalledWith('encrypted:xoxb-token');
  });

  it('caches the WebClient per teamId', async () => {
    db.slackInstallation.findFirst.mockResolvedValue({
      teamId: 'T123',
      botToken: 'encrypted:xoxb-token',
      isActive: true,
    } as any);

    await service.call('T123', 'chat.postMessage', { channel: 'C1' });
    await service.call('T123', 'chat.update', { channel: 'C1', ts: '123' });

    expect(db.slackInstallation.findFirst).toHaveBeenCalledTimes(1);
  });

  it('invalidates the cached client and fetches again', async () => {
    db.slackInstallation.findFirst.mockResolvedValue({
      teamId: 'T123',
      botToken: 'encrypted:xoxb-token',
      isActive: true,
    } as any);

    await service.call('T123', 'chat.postMessage', { channel: 'C1' });
    service.invalidateClient('T123');
    await service.call('T123', 'chat.postMessage', { channel: 'C1' });

    expect(db.slackInstallation.findFirst).toHaveBeenCalledTimes(2);
  });

  it('throws when no active installation exists', async () => {
    db.slackInstallation.findFirst.mockResolvedValue(null);

    await expect(service.call('T123', 'chat.postMessage', {})).rejects.toThrow(
      'No active Slack installation for team T123',
    );
  });

  it('enqueues slack api jobs', async () => {
    await service.enqueue('T123', 'chat.postMessage', {
      channel: 'C123',
      text: 'hello',
    });

    expect(queue.add).toHaveBeenCalledWith(
      'chat.postMessage',
      {
        teamId: 'T123',
        method: 'chat.postMessage',
        args: { channel: 'C123', text: 'hello' },
      },
      expect.objectContaining({
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
      }),
    );
  });
});
