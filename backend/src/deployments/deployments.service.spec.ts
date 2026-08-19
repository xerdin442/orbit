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
  DomainType,
} from '@generated/client';

describe('DeploymentsService', () => {
  let service: DeploymentsService;
  let db: jest.Mocked<Pick<DbService, 'environment' | 'deployment'>>;
  let activity: jest.Mocked<Pick<ActivityService, 'log'>>;
  let resources: jest.Mocked<Pick<ResourcesService, 'delete'>>;

  beforeEach(async () => {
    db = {
      environment: { findFirst: jest.fn() },
      deployment: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
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
      db.environment.findFirst = jest.fn().mockResolvedValue(null);
      await expect(service.createDeployment('env-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws if active deployment exists', async () => {
      db.environment.findFirst = jest.fn().mockResolvedValue({
        id: 'env-1',
        project: { ownerId: 'user-1' },
      });
      db.deployment.findFirst = jest.fn().mockResolvedValue({ id: 'dep-1' });

      await expect(service.createDeployment('env-1', 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('creates deployment with pending status', async () => {
      db.environment.findFirst = jest.fn().mockResolvedValue({
        id: 'env-1',
        project: { ownerId: 'user-1' },
      });
      db.deployment.findFirst = jest.fn().mockResolvedValue(null);
      db.deployment.create = jest.fn().mockResolvedValue({
        id: 'dep-1',
        trigger: DeploymentTrigger.manual,
      });

      const result = await service.createDeployment('env-1', 'user-1');
      expect(result.id).toBe('dep-1');
      expect(db.deployment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          environmentId: 'env-1',
          trigger: DeploymentTrigger.manual,
        }),
      });
      expect(activity.log).toHaveBeenCalled();
    });

    it('throws if the environment belongs to a different project than expected', async () => {
      db.environment.findFirst = jest.fn().mockResolvedValue({
        id: 'env-1',
        projectId: 'proj-1',
        project: { ownerId: 'user-1' },
      });

      await expect(
        service.createDeployment('env-1', 'user-1', 'proj-2'),
      ).rejects.toThrow(NotFoundException);

      expect(db.deployment.create).not.toHaveBeenCalled();
    });

    it('succeeds when expectedProjectId matches the environment project', async () => {
      db.environment.findFirst = jest.fn().mockResolvedValue({
        id: 'env-1',
        projectId: 'proj-1',
        project: { ownerId: 'user-1' },
      });
      db.deployment.findFirst = jest.fn().mockResolvedValue(null);
      db.deployment.create = jest.fn().mockResolvedValue({
        id: 'dep-1',
        trigger: DeploymentTrigger.manual,
      });

      const result = await service.createDeployment(
        'env-1',
        'user-1',
        'proj-1',
      );

      expect(result.id).toBe('dep-1');
    });
  });

  describe('findByIdForProject', () => {
    it('returns the deployment scoped to the given project, including its managed domain', async () => {
      db.deployment.findFirst = jest.fn().mockResolvedValue({
        id: 'dep-1',
        buildStatus: BuildStatus.ready,
        environment: {
          id: 'env-1',
          projectId: 'proj-1',
          domains: [{ hostname: 'app.orbit.dev' }],
        },
      });

      const result = await service.findByIdForProject('dep-1', 'proj-1');

      expect(result.id).toBe('dep-1');
      expect(db.deployment.findFirst).toHaveBeenCalledWith({
        where: { id: 'dep-1', environment: { projectId: 'proj-1' } },
        include: {
          environment: {
            include: {
              domains: { where: { type: DomainType.managed } },
            },
          },
        },
      });
    });

    it('throws if no deployment matches the project', async () => {
      db.deployment.findFirst = jest.fn().mockResolvedValue(null);

      await expect(
        service.findByIdForProject('dep-1', 'proj-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('triggerRedeployment', () => {
    it('throws if environment not found', async () => {
      db.environment.findFirst = jest.fn().mockResolvedValue(null);
      await expect(
        service.triggerRedeployment('env-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws if environment has no active deployment', async () => {
      db.environment.findFirst = jest.fn().mockResolvedValue({
        id: 'env-1',
        currentDeploymentId: null,
        project: { ownerId: 'user-1' },
      });

      await expect(
        service.triggerRedeployment('env-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates a redeploy deployment based on the current deployment', async () => {
      db.environment.findFirst = jest
        .fn()
        .mockResolvedValueOnce({
          id: 'env-1',
          currentDeploymentId: 'dep-current',
          project: { ownerId: 'user-1' },
        })
        .mockResolvedValueOnce(undefined);

      db.deployment.findFirst = jest.fn().mockResolvedValue({
        id: 'dep-current',
        environmentId: 'env-1',
        imageTag: 'project-proj-1:abc',
        commitSha: 'abc',
        commitMessage: 'init',
      });

      db.deployment.create = jest.fn().mockResolvedValue({
        id: 'dep-new',
        trigger: DeploymentTrigger.redeploy,
      });

      const result = await service.triggerRedeployment('env-1', 'user-1');

      expect(db.deployment.create).toHaveBeenCalledWith({
        data: {
          environmentId: 'env-1',
          trigger: DeploymentTrigger.redeploy,
          imageTag: 'project-proj-1:abc',
          commitSha: 'abc',
          commitMessage: 'init',
          buildStatus: BuildStatus.pending,
          lifecycleStatus: LifecycleStatus.inactive,
        },
      });
      expect(activity.log).toHaveBeenCalled();
      expect(result.id).toBe('dep-new');
    });
  });

  describe('findById', () => {
    it('throws when not found', async () => {
      db.deployment.findFirst = jest.fn().mockResolvedValue(null);
      await expect(service.findById('dep-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findForRollback', () => {
    it('throws if not found', async () => {
      db.deployment.findFirst = jest.fn().mockResolvedValue(null);
      await expect(service.findForRollback('dep-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws if deployment is not ready/inactive', async () => {
      db.deployment.findFirst = jest.fn().mockResolvedValue({
        id: 'dep-1',
        lifecycleStatus: LifecycleStatus.active,
        buildStatus: BuildStatus.deploying,
      });
      await expect(service.findForRollback('dep-1', 'user-1')).rejects.toThrow(
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
