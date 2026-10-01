import { SlackInstallationStore } from './slack-installation.store';
import { DbService } from '@src/db/db.service';
import { EncryptionService } from '@src/infrastructure/encryption.service';
import type { Installation, InstallationQuery } from '@slack/bolt';

describe('SlackInstallationStore', () => {
  let store: SlackInstallationStore;
  let db: jest.Mocked<Pick<DbService, 'slackInstallation'>>;
  let encryption: jest.Mocked<Pick<EncryptionService, 'encrypt' | 'decrypt'>>;

  const mockInstallation: Installation = {
    team: { id: 'T123', name: 'Test Team' },
    enterprise: undefined,
    user: { token: undefined, scopes: undefined, id: 'U456' },
    bot: {
      token: 'xoxb-secret-token',
      scopes: ['chat:write', 'app_mentions:read'],
      id: 'B789',
      userId: 'U789',
    },
    appId: 'A000',
    tokenType: 'bot',
    isEnterpriseInstall: false,
    authVersion: 'v2',
    metadata: 'user-platform-1',
  };

  beforeEach(() => {
    db = {
      slackInstallation: {
        upsert: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    } as unknown as jest.Mocked<Pick<DbService, 'slackInstallation'>>;

    encryption = {
      encrypt: jest.fn((v: string) => `encrypted:${v}`),
      decrypt: jest.fn((v: string) => v.replace('encrypted:', '')),
    };

    store = new SlackInstallationStore(
      db as unknown as DbService,
      encryption as unknown as EncryptionService,
    );
  });

  describe('storeInstallation', () => {
    it('upserts installation with encrypted token', async () => {
      await store.storeInstallation(mockInstallation);

      expect(encryption.encrypt).toHaveBeenCalledWith('xoxb-secret-token');
      expect(db.slackInstallation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { teamId: 'T123' },
          create: expect.objectContaining({
            userId: 'user-platform-1',
            teamId: 'T123',
            botToken: 'encrypted:xoxb-secret-token',
            isActive: true,
          }),
          update: expect.objectContaining({
            isActive: true,
          }),
        }),
      );
    });

    it('throws when metadata (userId) is missing', async () => {
      const install = { ...mockInstallation, metadata: undefined };

      await expect(store.storeInstallation(install)).rejects.toThrow(
        'userId is required',
      );
    });

    it('throws when bot token is missing', async () => {
      const install = {
        ...mockInstallation,
        bot: undefined,
      };

      await expect(store.storeInstallation(install)).rejects.toThrow(
        'bot token is required',
      );
    });
  });

  describe('fetchInstallation', () => {
    const query: InstallationQuery<boolean> = {
      teamId: 'T123',
      enterpriseId: undefined,
      isEnterpriseInstall: false,
    };

    const storedRecord = {
      id: 'inst-1',
      raw: mockInstallation,
      botToken: 'encrypted:xoxb-secret-token',
    };

    it('returns installation with decrypted token', async () => {
      db.slackInstallation.findFirst.mockResolvedValue(
        storedRecord as unknown as ReturnType<typeof db.slackInstallation.findFirst>,
      );

      const result = await store.fetchInstallation(query);

      expect(db.slackInstallation.findFirst).toHaveBeenCalledWith({
        where: { teamId: 'T123', isActive: true },
      });
      expect(encryption.decrypt).toHaveBeenCalledWith(
        'encrypted:xoxb-secret-token',
      );
      expect(result.bot?.token).toBe('xoxb-secret-token');
    });

    it('throws when installation not found', async () => {
      db.slackInstallation.findFirst.mockResolvedValue(null);

      await expect(store.fetchInstallation(query)).rejects.toThrow(
        'No active installation found for team T123',
      );
    });

    it('filters by enterpriseId for enterprise installs', async () => {
      const enterpriseQuery: InstallationQuery<boolean> = {
        teamId: undefined,
        enterpriseId: 'E123',
        isEnterpriseInstall: true,
      };

      db.slackInstallation.findFirst.mockResolvedValue(
        storedRecord as unknown as ReturnType<typeof db.slackInstallation.findFirst>,
      );

      await store.fetchInstallation(enterpriseQuery);

      expect(db.slackInstallation.findFirst).toHaveBeenCalledWith({
        where: { enterpriseId: 'E123', isActive: true },
      });
    });
  });

  describe('deleteInstallation', () => {
    const query: InstallationQuery<boolean> = {
      teamId: 'T123',
      enterpriseId: undefined,
      isEnterpriseInstall: false,
    };

    it('soft-deletes by setting isActive to false', async () => {
      db.slackInstallation.findFirst.mockResolvedValue({
        id: 'inst-1',
      } as unknown as ReturnType<typeof db.slackInstallation.findFirst>);

      await store.deleteInstallation(query);

      expect(db.slackInstallation.update).toHaveBeenCalledWith({
        where: { id: 'inst-1' },
        data: { isActive: false },
      });
    });

    it('does nothing when installation already gone', async () => {
      db.slackInstallation.findFirst.mockResolvedValue(null);

      await store.deleteInstallation(query);

      expect(db.slackInstallation.update).not.toHaveBeenCalled();
    });
  });
});
