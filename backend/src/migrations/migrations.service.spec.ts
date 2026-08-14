import { MigrationsService } from './migrations.service';
import { DbService } from '@src/db/db.service';
import { EncryptionService } from '@src/infrastructure/encryption.service';
import { ActivityService } from '@src/activity/activity.service';
import { RailwayProvider } from './providers/railway.provider';
import { VercelProvider } from './providers/vercel.provider';
import { ActivityType, ExternalProvider } from '@generated/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('MigrationsService', () => {
  let service: MigrationsService;
  let db: jest.Mocked<Pick<DbService, 'externalConnection'>>;
  let encryption: jest.Mocked<Pick<EncryptionService, 'encrypt' | 'decrypt'>>;
  let activity: jest.Mocked<Pick<ActivityService, 'log'>>;
  let railway: jest.Mocked<RailwayProvider>;
  let vercel: jest.Mocked<VercelProvider>;

  beforeEach(() => {
    db = {
      externalConnection: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
    } as unknown as jest.Mocked<Pick<DbService, 'externalConnection'>>;

    encryption = {
      encrypt: jest.fn((v: string) => `encrypted:${v}`),
      decrypt: jest.fn((v: string) => v.replace('encrypted:', '')),
    };

    activity = { log: jest.fn() };

    railway = {
      validateToken: jest.fn().mockResolvedValue(true),
      listProjects: jest.fn(),
      getProjectDetail: jest.fn(),
    } as unknown as jest.Mocked<RailwayProvider>;

    vercel = {
      validateToken: jest.fn().mockResolvedValue(true),
      listProjects: jest.fn(),
      getProjectDetail: jest.fn(),
    } as unknown as jest.Mocked<VercelProvider>;

    service = new MigrationsService(
      db as unknown as DbService,
      encryption as unknown as EncryptionService,
      activity as unknown as ActivityService,
      railway,
      vercel,
    );
  });

  describe('connect', () => {
    it('validates the token against the right provider, encrypts it and upserts the connection', async () => {
      await service.connect('user-1', ExternalProvider.railway, 'raw-token');

      expect(railway.validateToken).toHaveBeenCalledWith('raw-token');
      expect(vercel.validateToken).not.toHaveBeenCalled();
      expect(encryption.encrypt).toHaveBeenCalledWith('raw-token');
      expect(db.externalConnection.upsert).toHaveBeenCalledWith({
        where: {
          userId_provider: {
            userId: 'user-1',
            provider: ExternalProvider.railway,
          },
        },
        create: {
          userId: 'user-1',
          provider: ExternalProvider.railway,
          accessToken: 'encrypted:raw-token',
        },
        update: { accessToken: 'encrypted:raw-token' },
      });
    });

    it('logs an external_connection_added activity', async () => {
      await service.connect('user-1', ExternalProvider.vercel, 'raw-token');

      expect(activity.log).toHaveBeenCalledWith(
        ActivityType.external_connection_added,
        'user-1',
        { provider: ExternalProvider.vercel },
      );
    });

    it('rejects and never stores the token when validation fails', async () => {
      vercel.validateToken.mockResolvedValue(false);

      await expect(
        service.connect('user-1', ExternalProvider.vercel, 'bad-token'),
      ).rejects.toThrow(BadRequestException);

      expect(db.externalConnection.upsert).not.toHaveBeenCalled();
      expect(activity.log).not.toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('deletes the connection and logs activity when it exists', async () => {
      (db.externalConnection.findUnique as jest.Mock).mockResolvedValue({
        id: 'conn-1',
      });

      await service.disconnect('user-1', ExternalProvider.vercel);

      expect(db.externalConnection.delete).toHaveBeenCalledWith({
        where: { id: 'conn-1' },
      });
      expect(activity.log).toHaveBeenCalledWith(
        ActivityType.external_connection_removed,
        'user-1',
        { provider: ExternalProvider.vercel },
      );
    });

    it('does nothing when no connection exists', async () => {
      (db.externalConnection.findUnique as jest.Mock).mockResolvedValue(null);

      await service.disconnect('user-1', ExternalProvider.railway);

      expect(db.externalConnection.delete).not.toHaveBeenCalled();
      expect(activity.log).not.toHaveBeenCalled();
    });
  });

  describe('listProjects', () => {
    it('decrypts the stored token and delegates to the matching provider', async () => {
      (db.externalConnection.findUnique as jest.Mock).mockResolvedValue({
        id: 'conn-1',
        accessToken: 'encrypted:raw-token',
      });
      vercel.listProjects.mockResolvedValue([]);

      await service.listProjects('user-1', ExternalProvider.vercel);

      expect(encryption.decrypt).toHaveBeenCalledWith('encrypted:raw-token');
      expect(vercel.listProjects).toHaveBeenCalledWith('raw-token');
    });

    it('throws when no connection exists for that provider', async () => {
      (db.externalConnection.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.listProjects('user-1', ExternalProvider.railway),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getProjectDetail', () => {
    it('decrypts the stored token and delegates to the matching provider', async () => {
      (db.externalConnection.findUnique as jest.Mock).mockResolvedValue({
        id: 'conn-1',
        accessToken: 'encrypted:raw-token',
      });
      const detail = {
        id: 'proj-1',
        name: 'proj',
        repoFullName: 'org/repo',
        defaultBranch: 'main',
        envVars: [],
        domains: [],
      };
      railway.getProjectDetail.mockResolvedValue(detail);

      const result = await service.getProjectDetail(
        'user-1',
        ExternalProvider.railway,
        'proj-1:env-1:svc-1',
      );

      expect(encryption.decrypt).toHaveBeenCalledWith('encrypted:raw-token');
      expect(railway.getProjectDetail).toHaveBeenCalledWith(
        'raw-token',
        'proj-1:env-1:svc-1',
      );
      expect(result).toBe(detail);
    });
  });
});
