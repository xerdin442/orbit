import { Test, TestingModule } from '@nestjs/testing';
import { DeploymentsService } from './deployments.service';
import { DbService } from '@src/db/db.service';
import { ActivityService } from '@src/activity/activity.service';
import { ResourcesService } from '@src/resources/resources.service';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import {
  BuildStatus,
  LifecycleStatus,
  DeploymentTrigger,
} from '@generated/client';

describe('DeploymentsService', () => {
  let service: DeploymentsService;
  let db: jest.Mocked<Pick<DbService, 'environment' | 'deployment'>>;
  let activity: jest.Mocked<Pick<ActivityService, 'log'>>;
  let resources: jest.Mocked<Pick<ResourcesService, 'delete'>>;

  beforeEach(async () => {
    db = {
      environment: { findUnique: jest.fn() },
      deployment: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    } as unknown as jest.Mocked<Pick<DbService, 'environment' | 'deployment'>>;

    activity = { log: jest.fn() };
    resources = { delete: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeploymentsService,
        { provide: DbService, useValue: db },
        { provide: ActivityService, useValue: activity },
        { provide: ResourcesService, useValue: resources },
      ],
    }).compile();

    service = module.get(DeploymentsService);
  });

  describe('createDeployment', () => {
    it('throws if environment not found', async () => {
      db.environment.findUnique = jest.fn().mockResolvedValue(null);
      await expect(
        service.createDeployment('env-1', DeploymentTrigger.manual),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws if active deployment exists', async () => {
      db.environment.findUnique = jest.fn().mockResolvedValue({ id: 'env-1' });
      db.deployment.findFirst = jest.fn().mockResolvedValue({ id: 'dep-1' });

      await expect(
        service.createDeployment('env-1', DeploymentTrigger.manual),
      ).rejects.toThrow(ConflictException);
    });

    it('creates deployment with pending status', async () => {
      db.environment.findUnique = jest.fn().mockResolvedValue({
        id: 'env-1',
        project: { ownerId: 'user-1' },
      });
      db.deployment.findFirst = jest.fn().mockResolvedValue(null);
      db.deployment.create = jest.fn().mockResolvedValue({ id: 'dep-1' });

      const result = await service.createDeployment(
        'env-1',
        DeploymentTrigger.manual,
      );
      expect(result.id).toBe('dep-1');
      expect(activity.log).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('throws when not found', async () => {
      db.deployment.findUnique = jest.fn().mockResolvedValue(null);
      await expect(service.findById('dep-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findForRollback', () => {
    it('throws if not found', async () => {
      db.deployment.findUnique = jest.fn().mockResolvedValue(null);
      await expect(service.findForRollback('dep-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws if deployment is not ready/inactive', async () => {
      db.deployment.findUnique = jest.fn().mockResolvedValue({
        id: 'dep-1',
        lifecycleStatus: LifecycleStatus.active,
        buildStatus: BuildStatus.deploying,
      });
      await expect(service.findForRollback('dep-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateBuildStatus', () => {
    it('updates build status', async () => {
      await service.updateBuildStatus('dep-1', BuildStatus.cloning);
      expect(db.deployment.update).toHaveBeenCalledWith({
        where: { id: 'dep-1' },
        data: { buildStatus: BuildStatus.cloning },
      });
    });
  });

  describe('markCompleted', () => {
    it('sets completedAt', async () => {
      await service.markCompleted('dep-1');
      expect(db.deployment.update).toHaveBeenCalledWith({
        where: { id: 'dep-1' },
        data: expect.objectContaining({ completedAt: expect.any(Date) }),
      });
    });
  });

  describe('markFailed', () => {
    it('sets failed and aborted', async () => {
      await service.markFailed('dep-1');
      expect(db.deployment.update).toHaveBeenCalledWith({
        where: { id: 'dep-1' },
        data: {
          buildStatus: BuildStatus.failed,
          lifecycleStatus: LifecycleStatus.aborted,
        },
      });
    });
  });
});
