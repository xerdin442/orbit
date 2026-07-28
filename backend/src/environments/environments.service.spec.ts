import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { EnvironmentsService } from './environments.service';
import { DbService } from '@src/db/db.service';
import { EncryptionService } from '@src/infrastructure/encryption.service';
import { ActivityService } from '@src/activity/activity.service';
import { CleanupService } from '@src/cleanup/cleanup.service';
import { NotFoundException } from '@nestjs/common';
import type { Queue } from 'bull';

describe('EnvironmentsService', () => {
  let service: EnvironmentsService;
  let db: jest.Mocked<
    Pick<
      DbService,
      'project' | 'environment' | 'environmentVariable' | 'deployment'
    >
  >;
  let encryption: jest.Mocked<Pick<EncryptionService, 'encrypt' | 'decrypt'>>;
  let activity: jest.Mocked<Pick<ActivityService, 'log'>>;
  let cleanup: jest.Mocked<
    Pick<CleanupService, 'enqueueProjectCleanup' | 'enqueueEnvironmentCleanup'>
  >;
  let queue: jest.Mocked<Pick<Queue, 'add'>>;

  beforeEach(async () => {
    db = {
      project: { findFirst: jest.fn() },
      environment: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
      },
      environmentVariable: {
        findMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      deployment: { create: jest.fn() },
    } as unknown as jest.Mocked<
      Pick<
        DbService,
        'project' | 'environment' | 'environmentVariable' | 'deployment'
      >
    >;

    encryption = {
      encrypt: jest.fn((v) => `enc_${v}`),
      decrypt: jest.fn((v) => v.replace('enc_', '')),
    };
    activity = { log: jest.fn() };
    cleanup = {
      enqueueProjectCleanup: jest.fn(),
      enqueueEnvironmentCleanup: jest.fn(),
    };
    queue = { add: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnvironmentsService,
        { provide: DbService, useValue: db },
        { provide: EncryptionService, useValue: encryption },
        { provide: ActivityService, useValue: activity },
        { provide: CleanupService, useValue: cleanup },
        { provide: CACHE_MANAGER, useValue: { del: jest.fn() } },
        { provide: 'BullQueue_deployments', useValue: queue },
      ],
    }).compile();

    service = module.get(EnvironmentsService);
  });

  describe('create', () => {
    it('creates environment after verifying ownership', async () => {
      db.project.findFirst.mockResolvedValue({
        id: 'proj-1',
        ownerId: 'user-1',
      });
      db.environment.create.mockResolvedValue({ id: 'env-1', name: 'staging' });

      await service.create('proj-1', 'user-1', {
        name: 'staging',
        branch: 'develop',
      });

      expect(db.environment.create).toHaveBeenCalledWith({
        data: {
          name: 'staging',
          branch: 'develop',
          autoDeploy: false,
          projectId: 'proj-1',
        },
      });
    });

    it('throws if project not owned', async () => {
      db.project.findFirst.mockResolvedValue(null);
      await expect(
        service.create('proj-1', 'user-1', {
          name: 'staging',
          branch: 'develop',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findById', () => {
    it('returns env after verifying ownership', async () => {
      db.environment.findUnique.mockResolvedValue({
        id: 'env-1',
        projectId: 'proj-1',
      });
      db.project.findFirst.mockResolvedValue({
        id: 'proj-1',
        ownerId: 'user-1',
      });

      const result = await service.findById('env-1', 'user-1');
      expect(result).toBeDefined();
    });
  });

  describe('getVariables', () => {
    it('returns decrypted variables', async () => {
      db.environment.findUnique.mockResolvedValue({
        id: 'env-1',
        projectId: 'proj-1',
      });
      db.project.findFirst.mockResolvedValue({
        id: 'proj-1',
        ownerId: 'user-1',
      });
      db.environmentVariable.findMany.mockResolvedValue([
        { id: 'v1', key: 'SECRET', value: 'enc_value', environmentId: 'env-1' },
      ]);

      const result = await service.getVariables('env-1', 'user-1');
      expect(result[0].value).toBe('value');
    });
  });

  describe('createVariable', () => {
    it('encrypts value and triggers redeploy', async () => {
      db.environment.findUnique.mockResolvedValue({
        id: 'env-1',
        projectId: 'proj-1',
      });
      db.project.findFirst.mockResolvedValue({
        id: 'proj-1',
        ownerId: 'user-1',
      });
      db.environmentVariable.create.mockResolvedValue({ id: 'v1' });
      db.environment.findUniqueOrThrow.mockResolvedValue({
        id: 'env-1',
        deployments: [{ imageTag: 'project-proj-1:abc', commitSha: 'abc', commitMessage: 'init' }],
      });
      db.deployment.create.mockResolvedValue({ id: 'dep-1' });

      await service.createVariable('env-1', 'user-1', {
        key: 'KEY',
        value: 'secret',
      });

      expect(encryption.encrypt).toHaveBeenCalledWith('secret');
      expect(queue.add).toHaveBeenCalled();
      expect(activity.log).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates after verification', async () => {
      db.environment.findUnique.mockResolvedValue({
        id: 'env-1',
        projectId: 'proj-1',
      });
      db.project.findFirst.mockResolvedValue({
        id: 'proj-1',
        ownerId: 'user-1',
      });
      db.environment.update.mockResolvedValue({ id: 'env-1', name: 'updated' });

      await service.update('env-1', 'user-1', { name: 'updated' });
      expect(db.environment.update).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('enqueues cleanup and deletes after verification', async () => {
      db.environment.findUnique.mockResolvedValue({
        id: 'env-1',
        projectId: 'proj-1',
      });
      db.project.findFirst.mockResolvedValue({
        id: 'proj-1',
        ownerId: 'user-1',
      });

      await service.delete('env-1', 'user-1');
      expect(cleanup.enqueueEnvironmentCleanup).toHaveBeenCalledWith('env-1');
      expect(db.environment.delete).toHaveBeenCalledWith({
        where: { id: 'env-1' },
      });
    });
  });
});
