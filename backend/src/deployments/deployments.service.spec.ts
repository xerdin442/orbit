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
  ActivityType,
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

    it('creates a rollback deployment when the target is ready/inactive', async () => {
      db.deployment.findFirst = jest.fn().mockResolvedValue({
        id: 'dep-1',
        environmentId: 'env-1',
        lifecycleStatus: LifecycleStatus.inactive,
        buildStatus: BuildStatus.ready,
        commitSha: 'abc123',
        commitMessage: 'initial commit',
        imageTag: 'project-1:abc123',
      });
      db.deployment.create = jest.fn().mockResolvedValue({
        id: 'dep-rollback',
        trigger: DeploymentTrigger.rollback,
      });

      const result = await service.findForRollback('dep-1', 'user-1');

      expect(db.deployment.create).toHaveBeenCalledWith({
        data: {
          environmentId: 'env-1',
          trigger: DeploymentTrigger.rollback,
          commitSha: 'abc123',
          commitMessage: 'initial commit',
          imageTag: 'project-1:abc123',
          buildStatus: BuildStatus.pending,
          lifecycleStatus: LifecycleStatus.inactive,
        },
      });
      expect(activity.log).toHaveBeenCalled();
      expect(result.id).toBe('dep-rollback');
    });
  });

  describe('findByEnvironment', () => {
    it('throws if environment not found', async () => {
      db.environment.findFirst = jest.fn().mockResolvedValue(null);
      await expect(
        service.findByEnvironment('env-1', 'user-1', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns a paginated result scoped to the environment', async () => {
      db.environment.findFirst = jest.fn().mockResolvedValue({
        id: 'env-1',
        project: { ownerId: 'user-1' },
      });
      db.deployment.findMany = jest
        .fn()
        .mockResolvedValue([{ id: 'dep-1' }, { id: 'dep-2' }]);
      db.deployment.count = jest.fn().mockResolvedValue(2);

      const result = await service.findByEnvironment('env-1', 'user-1', {});

      expect(db.deployment.findMany).toHaveBeenCalledWith({
        where: { environmentId: 'env-1' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
      });
      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });
    });

    it('applies trigger and status filters', async () => {
      db.environment.findFirst = jest.fn().mockResolvedValue({
        id: 'env-1',
        project: { ownerId: 'user-1' },
      });
      db.deployment.findMany = jest.fn().mockResolvedValue([]);
      db.deployment.count = jest.fn().mockResolvedValue(0);

      await service.findByEnvironment('env-1', 'user-1', {
        page: 2,
        limit: 10,
        trigger: DeploymentTrigger.webhook,
        status: BuildStatus.failed,
      });

      expect(db.deployment.findMany).toHaveBeenCalledWith({
        where: {
          environmentId: 'env-1',
          trigger: DeploymentTrigger.webhook,
          buildStatus: BuildStatus.failed,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 10,
      });
    });

    it('applies the startDate filter as a lower bound', async () => {
      db.environment.findFirst = jest.fn().mockResolvedValue({
        id: 'env-1',
        project: { ownerId: 'user-1' },
      });
      db.deployment.findMany = jest.fn().mockResolvedValue([]);
      db.deployment.count = jest.fn().mockResolvedValue(0);

      const startDate = new Date('2026-01-01T00:00:00.000Z');

      await service.findByEnvironment('env-1', 'user-1', { startDate });

      expect(db.deployment.findMany).toHaveBeenCalledWith({
        where: {
          environmentId: 'env-1',
          createdAt: { gte: startDate },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
      });
    });

    it('applies the endDate filter as an upper bound extended to end of day', async () => {
      db.environment.findFirst = jest.fn().mockResolvedValue({
        id: 'env-1',
        project: { ownerId: 'user-1' },
      });
      db.deployment.findMany = jest.fn().mockResolvedValue([]);
      db.deployment.count = jest.fn().mockResolvedValue(0);

      const endDate = new Date('2026-01-31T00:00:00.000Z');

      await service.findByEnvironment('env-1', 'user-1', { endDate });

      expect(db.deployment.findMany).toHaveBeenCalledWith({
        where: {
          environmentId: 'env-1',
          createdAt: { lte: endDate },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
      });
      expect(endDate.getHours()).toBe(23);
    });

    it('drops the endDate bound when both startDate and endDate are given', async () => {
      // The service applies endDate first, then overwrites `where.createdAt`
      // entirely when startDate is also present, so only `gte` survives.
      db.environment.findFirst = jest.fn().mockResolvedValue({
        id: 'env-1',
        project: { ownerId: 'user-1' },
      });
      db.deployment.findMany = jest.fn().mockResolvedValue([]);
      db.deployment.count = jest.fn().mockResolvedValue(0);

      const startDate = new Date('2026-01-01T00:00:00.000Z');
      const endDate = new Date('2026-01-31T00:00:00.000Z');

      await service.findByEnvironment('env-1', 'user-1', {
        startDate,
        endDate,
      });

      expect(db.deployment.findMany).toHaveBeenCalledWith({
        where: {
          environmentId: 'env-1',
          createdAt: { gte: startDate },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
      });
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

  describe('updateCommit', () => {
    it('updates commit sha and message', async () => {
      await service.updateCommit('dep-1', 'abc123', 'initial commit');
      expect(db.deployment.update).toHaveBeenCalledWith({
        where: { id: 'dep-1' },
        data: { commitSha: 'abc123', commitMessage: 'initial commit' },
      });
    });
  });

  describe('updateBuildImage', () => {
    it('updates the image tag', async () => {
      await service.updateBuildImage('dep-1', 'app:latest');
      expect(db.deployment.update).toHaveBeenCalledWith({
        where: { id: 'dep-1' },
        data: { imageTag: 'app:latest' },
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

  describe('updateContainerId', () => {
    it('updates the container id', async () => {
      await service.updateContainerId('dep-1', 'container-123');
      expect(db.deployment.update).toHaveBeenCalledWith({
        where: { id: 'dep-1' },
        data: { containerId: 'container-123' },
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

    it('records the stage the deployment failed at', async () => {
      await service.markFailed('dep-1', BuildStatus.building);
      expect(db.deployment.update).toHaveBeenCalledWith({
        where: { id: 'dep-1' },
        data: {
          buildStatus: BuildStatus.failed,
          failedStage: BuildStatus.building,
          lifecycleStatus: LifecycleStatus.aborted,
        },
      });
    });
  });

  describe('abortDeployment', () => {
    it('marks the deployment aborted, recording the stage it was aborted at', async () => {
      db.deployment.findFirst = jest.fn().mockResolvedValue({
        id: 'dep-1',
        environmentId: 'env-1',
        buildStatus: BuildStatus.building,
      });

      await service.abortDeployment('dep-1', 'user-1');

      expect(db.deployment.update).toHaveBeenCalledWith({
        where: { id: 'dep-1' },
        data: {
          buildStatus: BuildStatus.aborted,
          failedStage: BuildStatus.building,
          lifecycleStatus: LifecycleStatus.aborted,
          completedAt: expect.any(Date),
        },
      });
      expect(activity.log).toHaveBeenCalledWith(
        ActivityType.deployment_aborted,
        'user-1',
        { deploymentId: 'dep-1', environmentId: 'env-1' },
      );
      expect(resources.delete).not.toHaveBeenCalled();
    });

    it('deletes the given resources, ignoring ones that fail to delete', async () => {
      db.deployment.findFirst = jest.fn().mockResolvedValue({
        id: 'dep-1',
        environmentId: 'env-1',
        buildStatus: BuildStatus.building,
      });
      resources.delete = jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('already gone'));

      await service.abortDeployment('dep-1', 'user-1', ['res-1', 'res-2']);

      expect(resources.delete).toHaveBeenCalledWith('res-1', 'user-1');
      expect(resources.delete).toHaveBeenCalledWith('res-2', 'user-1');
    });

    it('throws if the deployment is not found', async () => {
      db.deployment.findFirst = jest.fn().mockResolvedValue(null);
      await expect(
        service.abortDeployment('dep-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
