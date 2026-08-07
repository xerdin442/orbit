import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { EnvironmentsService } from './environments.service';
import { DbService } from '@src/db/db.service';
import { EncryptionService } from '@src/infrastructure/encryption.service';
import { ActivityService } from '@src/activity/activity.service';
import { CleanupService } from '@src/cleanup/cleanup.service';
import { DeploymentsService } from '@src/deployments/deployments.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';

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
  let deployments: jest.Mocked<
    Pick<DeploymentsService, 'createDeployment' | 'triggerRedeployment'>
  >;
  let queue: jest.Mocked<Pick<Queue, 'add'>>;

  beforeEach(async () => {
    db = {
      project: { findFirst: jest.fn() },
      environment: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
      },
      environmentVariable: {
        findMany: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
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
    deployments = {
      createDeployment: jest.fn(),
      triggerRedeployment: jest.fn(),
    };
    queue = { add: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnvironmentsService,
        { provide: DbService, useValue: db },
        { provide: EncryptionService, useValue: encryption },
        { provide: ActivityService, useValue: activity },
        { provide: CleanupService, useValue: cleanup },
        { provide: DeploymentsService, useValue: deployments },
        { provide: CACHE_MANAGER, useValue: { del: jest.fn() } },
        { provide: getQueueToken('deployments'), useValue: queue },
      ],
    }).compile();

    service = module.get(EnvironmentsService);
  });

  describe('create', () => {
    it('creates environment after verifying ownership and triggers initial deployment', async () => {
      db.project.findFirst.mockResolvedValue({
        id: 'proj-1',
        ownerId: 'user-1',
      });
      db.environment.findFirst.mockResolvedValue(null);
      db.environment.create.mockResolvedValue({ id: 'env-1', name: 'staging' });
      deployments.createDeployment.mockResolvedValue({ id: 'dep-1' });

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
      expect(deployments.createDeployment).toHaveBeenCalledWith(
        'env-1',
        'user-1',
      );
      expect(queue.add).toHaveBeenCalledWith('deploy', {
        deployment: { id: 'dep-1' },
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

    it('throws if branch is already connected to an environment', async () => {
      db.project.findFirst.mockResolvedValue({
        id: 'proj-1',
        ownerId: 'user-1',
      });
      db.environment.findFirst.mockResolvedValue({
        id: 'env-existing',
        branch: 'develop',
      });

      await expect(
        service.create('proj-1', 'user-1', {
          name: 'staging',
          branch: 'develop',
        }),
      ).rejects.toThrow(ConflictException);

      expect(db.environment.create).not.toHaveBeenCalled();
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

  describe('findAllByProject', () => {
    it('verifies ownership and returns environments', async () => {
      db.project.findFirst.mockResolvedValue({
        id: 'proj-1',
        ownerId: 'user-1',
      });
      db.environment.findMany.mockResolvedValue([
        { id: 'env-1', name: 'production', projectId: 'proj-1' },
        { id: 'env-2', name: 'staging', projectId: 'proj-1' },
      ]);

      const result = await service.findAllByProject('proj-1', 'user-1');

      expect(db.environment.findMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toHaveLength(2);
    });

    it('throws if project is not owned by user', async () => {
      db.project.findFirst.mockResolvedValue(null);

      await expect(
        service.findAllByProject('proj-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
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
      deployments.triggerRedeployment.mockResolvedValue({ id: 'dep-1' });

      await service.createVariable('env-1', 'user-1', {
        key: 'KEY',
        value: 'secret',
      });

      expect(encryption.encrypt).toHaveBeenCalledWith('secret');
      expect(deployments.triggerRedeployment).toHaveBeenCalledWith(
        'env-1',
        'user-1',
      );
      expect(queue.add).toHaveBeenCalledWith('redeploy', {
        deployment: { id: 'dep-1' },
        skipImageBuild: true,
      });
      expect(activity.log).toHaveBeenCalled();
    });

    it('skips redeploy when skipRedeploy is true', async () => {
      db.environment.findUnique.mockResolvedValue({
        id: 'env-1',
        projectId: 'proj-1',
      });
      db.project.findFirst.mockResolvedValue({
        id: 'proj-1',
        ownerId: 'user-1',
      });
      db.environmentVariable.create.mockResolvedValue({ id: 'v1' });

      await service.createVariable(
        'env-1',
        'user-1',
        { key: 'KEY', value: 'secret' },
        true,
      );

      expect(deployments.triggerRedeployment).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('bulkCreateVariables', () => {
    it('encrypts all values and calls createMany', async () => {
      db.environment.findUnique.mockResolvedValue({
        id: 'env-1',
        projectId: 'proj-1',
      });
      db.project.findFirst.mockResolvedValue({
        id: 'proj-1',
        ownerId: 'user-1',
      });
      db.environmentVariable.createMany.mockResolvedValue({ count: 2 });
      deployments.triggerRedeployment.mockResolvedValue({ id: 'dep-1' });

      const result = await service.bulkCreateVariables('env-1', 'user-1', {
        variables: [
          { key: 'KEY_A', value: 'val_a' },
          { key: 'KEY_B', value: 'val_b' },
        ],
      });

      expect(encryption.encrypt).toHaveBeenCalledWith('val_a');
      expect(encryption.encrypt).toHaveBeenCalledWith('val_b');
      expect(db.environmentVariable.createMany).toHaveBeenCalledWith({
        data: [
          { key: 'KEY_A', value: 'enc_val_a', environmentId: 'env-1' },
          { key: 'KEY_B', value: 'enc_val_b', environmentId: 'env-1' },
        ],
      });
      expect(queue.add).toHaveBeenCalled();
      expect(activity.log).toHaveBeenCalledWith(
        expect.stringContaining('variable_created'),
        'user-1',
        expect.objectContaining({ keys: 'KEY_A,KEY_B' }),
      );
      expect(result).toEqual({ count: 2 });
    });
  });

  describe('updateVariable', () => {
    it('updates only the value when key is omitted', async () => {
      db.environmentVariable.findUnique.mockResolvedValue({
        id: 'v1',
        key: 'KEY',
        environmentId: 'env-1',
      });
      db.environmentVariable.update.mockResolvedValue({
        id: 'v1',
        environment: { id: 'env-1', projectId: 'proj-1' },
      });
      deployments.triggerRedeployment.mockResolvedValue({ id: 'dep-1' });

      await service.updateVariable('v1', 'user-1', { value: 'new_secret' });

      expect(encryption.encrypt).toHaveBeenCalledWith('new_secret');
      expect(db.environmentVariable.update).toHaveBeenCalledWith({
        where: { id: 'v1' },
        data: { value: 'enc_new_secret' },
        include: { environment: true },
      });
    });

    it('updates only the key when value is omitted', async () => {
      db.environmentVariable.findUnique.mockResolvedValue({
        id: 'v1',
        key: 'OLD_KEY',
        environmentId: 'env-1',
      });
      db.environmentVariable.update.mockResolvedValue({
        id: 'v1',
        environment: { id: 'env-1', projectId: 'proj-1' },
      });
      deployments.triggerRedeployment.mockResolvedValue({ id: 'dep-1' });

      await service.updateVariable('v1', 'user-1', { key: 'NEW_KEY' });

      expect(encryption.encrypt).not.toHaveBeenCalled();
      expect(db.environmentVariable.update).toHaveBeenCalledWith({
        where: { id: 'v1' },
        data: { key: 'NEW_KEY' },
        include: { environment: true },
      });
    });

    it('updates both key and value when both are provided', async () => {
      db.environmentVariable.findUnique.mockResolvedValue({
        id: 'v1',
        key: 'OLD_KEY',
        environmentId: 'env-1',
      });
      db.environmentVariable.update.mockResolvedValue({
        id: 'v1',
        environment: { id: 'env-1', projectId: 'proj-1' },
      });
      deployments.triggerRedeployment.mockResolvedValue({ id: 'dep-1' });

      await service.updateVariable('v1', 'user-1', {
        key: 'NEW_KEY',
        value: 'new_secret',
      });

      expect(db.environmentVariable.update).toHaveBeenCalledWith({
        where: { id: 'v1' },
        data: { key: 'NEW_KEY', value: 'enc_new_secret' },
        include: { environment: true },
      });
    });

    it('throws if variable does not exist', async () => {
      db.environmentVariable.findUnique.mockResolvedValue(null);

      await expect(
        service.updateVariable('missing', 'user-1', { value: 'x' }),
      ).rejects.toThrow(NotFoundException);

      expect(db.environmentVariable.update).not.toHaveBeenCalled();
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
      expect(deployments.createDeployment).not.toHaveBeenCalled();
    });

    it('verifies branch uniqueness and triggers a new deployment when branch changes', async () => {
      db.environment.findUnique.mockResolvedValue({
        id: 'env-1',
        projectId: 'proj-1',
      });
      db.project.findFirst.mockResolvedValue({
        id: 'proj-1',
        ownerId: 'user-1',
      });
      db.environment.findFirst.mockResolvedValue(null);
      db.environment.update.mockResolvedValue({
        id: 'env-1',
        projectId: 'proj-1',
        branch: 'main',
      });
      deployments.createDeployment.mockResolvedValue({ id: 'dep-1' });

      await service.update('env-1', 'user-1', { branch: 'main' });

      expect(db.environment.findFirst).toHaveBeenCalledWith({
        where: { projectId: 'proj-1', branch: 'main' },
      });
      expect(deployments.createDeployment).toHaveBeenCalledWith(
        'env-1',
        'user-1',
      );
      expect(queue.add).toHaveBeenCalledWith('deploy', {
        deployment: { id: 'dep-1' },
      });
    });

    it('throws if the new branch is already connected to another environment', async () => {
      db.environment.findUnique.mockResolvedValue({
        id: 'env-1',
        projectId: 'proj-1',
      });
      db.project.findFirst.mockResolvedValue({
        id: 'proj-1',
        ownerId: 'user-1',
      });
      db.environment.findFirst.mockResolvedValue({
        id: 'env-other',
        branch: 'main',
      });

      await expect(
        service.update('env-1', 'user-1', { branch: 'main' }),
      ).rejects.toThrow(ConflictException);

      expect(db.environment.update).not.toHaveBeenCalled();
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
