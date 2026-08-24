import { rm } from 'fs/promises';
import type { Job } from 'bullmq';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { DeploymentProcessor } from './deployment.processor';
import {
  BuildStatus,
  LogLevel,
  ActivityType,
  ResourceStatus,
} from '@generated/enums';
import { DeploymentJob, DeploymentStepExecutionError } from '@src/common/types';
import type { DockerService } from '@src/infrastructure/docker.service';
import type { CommandService } from '@src/infrastructure/command.service';
import type { CaddyService } from '@src/infrastructure/caddy.service';
import type { DbService } from '@src/db/db.service';
import type { LogService } from '@src/infrastructure/log.service';
import type { DeploymentsService } from './deployments.service';
import type { ActivityService } from '@src/activity/activity.service';
import type { GitHubService } from '@src/github/github.service';

jest.mock('fs/promises', () => ({
  rm: jest.fn().mockResolvedValue(undefined),
}));

const mockExecuteCloneRepository = jest.fn().mockResolvedValue(undefined);
const mockExecuteResolveCommit = jest.fn().mockResolvedValue(undefined);
const mockExecuteBuildImage = jest.fn().mockResolvedValue(undefined);
const mockExecuteCreateContainer = jest.fn().mockResolvedValue(undefined);
const mockExecuteStartContainer = jest.fn().mockResolvedValue(undefined);
const mockExecuteHealthCheck = jest.fn().mockResolvedValue(undefined);
const mockExecuteActivateDeployment = jest.fn().mockResolvedValue(undefined);
const mockExecuteConfigureProxy = jest.fn().mockResolvedValue(undefined);
const mockExecuteCleanup = jest.fn().mockResolvedValue(undefined);

jest.mock('./pipeline', () => {
  const { DeploymentStepName: Names } =
    jest.requireActual<typeof import('@src/common/types')>('@src/common/types');
  const mockStep = (name: string, getExecute: () => jest.Mock) =>
    function () {
      return { name, execute: getExecute() };
    };
  return {
    CloneRepositoryStep: mockStep(
      Names.CloneRepository,
      () => mockExecuteCloneRepository,
    ),
    ResolveCommitStep: mockStep(
      Names.ResolveCommit,
      () => mockExecuteResolveCommit,
    ),
    BuildImageStep: mockStep(Names.BuildImage, () => mockExecuteBuildImage),
    CreateContainerStep: mockStep(
      Names.CreateContainer,
      () => mockExecuteCreateContainer,
    ),
    StartContainerStep: mockStep(
      Names.StartContainer,
      () => mockExecuteStartContainer,
    ),
    HealthCheckStep: mockStep(Names.HealthCheck, () => mockExecuteHealthCheck),
    ActivateDeploymentStep: mockStep(
      Names.ActivateDeployment,
      () => mockExecuteActivateDeployment,
    ),
    ConfigureProxyStep: mockStep(
      Names.ConfigureProxy,
      () => mockExecuteConfigureProxy,
    ),
    CleanupStep: mockStep(Names.Cleanup, () => mockExecuteCleanup),
  };
});

const DEPLOYMENT_ID = 'deployment-1';
const ENVIRONMENT_ID = 'environment-1';
const OWNER_ID = 'owner-1';

function buildJob(overrides: Partial<DeploymentJob> = {}): Job<DeploymentJob> {
  return {
    data: {
      deployment: {
        id: DEPLOYMENT_ID,
        environmentId: ENVIRONMENT_ID,
        imageTag: 'app:latest',
        commitSha: 'abc123',
        commitMessage: 'initial commit',
      },
      skipImageBuild: false,
      resourceCount: 0,
      ...overrides,
    },
  } as unknown as Job<DeploymentJob>;
}

function buildEnv(overrides: Record<string, unknown> = {}) {
  return {
    id: ENVIRONMENT_ID,
    project: {
      id: 'project-1',
      ownerId: OWNER_ID,
      source: { id: 'source-1' },
    },
    ...overrides,
  };
}

describe('DeploymentProcessor', () => {
  let processor: DeploymentProcessor;

  let docker: {
    stopContainer: jest.Mock;
    removeContainer: jest.Mock;
    getOrCreateProjectNetwork: jest.Mock;
    connectContainerToNetwork: jest.Mock;
  };
  let command: Record<string, jest.Mock>;
  let caddy: Record<string, jest.Mock>;
  let db: {
    environment: { findUnique: jest.Mock };
    environmentVariable: { findMany: jest.Mock };
    resource: { findMany: jest.Mock };
  };
  let logService: {
    append: jest.Mock;
    complete: jest.Mock;
  };
  let deployments: {
    findById: jest.Mock;
    updateBuildStatus: jest.Mock;
    updateCommit: jest.Mock;
    updateBuildImage: jest.Mock;
    updateContainerId: jest.Mock;
    markCompleted: jest.Mock;
    markFailed: jest.Mock;
  };
  let activity: {
    log: jest.Mock;
  };
  let eventEmitter: {
    emit: jest.Mock;
  };
  let github: Record<string, jest.Mock>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    docker = {
      stopContainer: jest.fn().mockResolvedValue(undefined),
      removeContainer: jest.fn().mockResolvedValue(undefined),
      getOrCreateProjectNetwork: jest
        .fn()
        .mockResolvedValue({ id: 'network-1' }),
      connectContainerToNetwork: jest.fn().mockResolvedValue(undefined),
    };
    command = {};
    caddy = {};
    db = {
      environment: { findUnique: jest.fn().mockResolvedValue(buildEnv()) },
      environmentVariable: { findMany: jest.fn().mockResolvedValue([]) },
      resource: { findMany: jest.fn().mockResolvedValue([]) },
    };
    logService = {
      append: jest.fn().mockResolvedValue(undefined),
      complete: jest.fn(),
    };
    deployments = {
      findById: jest
        .fn()
        .mockResolvedValue({ buildStatus: BuildStatus.pending }),
      updateBuildStatus: jest.fn().mockResolvedValue(undefined),
      updateCommit: jest.fn().mockResolvedValue(undefined),
      updateBuildImage: jest.fn().mockResolvedValue(undefined),
      updateContainerId: jest.fn().mockResolvedValue(undefined),
      markCompleted: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
    };
    activity = {
      log: jest.fn().mockResolvedValue(undefined),
    };
    eventEmitter = {
      emit: jest.fn(),
    };
    github = {};

    processor = new DeploymentProcessor(
      docker as unknown as DockerService,
      command as unknown as CommandService,
      caddy as unknown as CaddyService,
      db as unknown as DbService,
      logService as unknown as LogService,
      deployments as unknown as DeploymentsService,
      activity as unknown as ActivityService,
      eventEmitter as unknown as EventEmitter2,
      github as unknown as GitHubService,
    );

    // default: every step succeeds
    mockExecuteCloneRepository.mockResolvedValue(undefined);
    mockExecuteResolveCommit.mockResolvedValue(undefined);
    mockExecuteBuildImage.mockResolvedValue(undefined);
    mockExecuteCreateContainer.mockResolvedValue(undefined);
    mockExecuteStartContainer.mockResolvedValue(undefined);
    mockExecuteHealthCheck.mockResolvedValue(undefined);
    mockExecuteActivateDeployment.mockResolvedValue(undefined);
    mockExecuteConfigureProxy.mockResolvedValue(undefined);
    mockExecuteCleanup.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('process — happy path', () => {
    it('runs the full pipeline (including build steps) and marks the deployment completed', async () => {
      const job = buildJob({ skipImageBuild: false });

      await processor.process(job);

      expect(mockExecuteCloneRepository).toHaveBeenCalledTimes(1);
      expect(mockExecuteResolveCommit).toHaveBeenCalledTimes(1);
      expect(mockExecuteBuildImage).toHaveBeenCalledTimes(1);
      expect(mockExecuteCreateContainer).toHaveBeenCalledTimes(1);
      expect(mockExecuteStartContainer).toHaveBeenCalledTimes(1);
      expect(mockExecuteHealthCheck).toHaveBeenCalledTimes(1);
      expect(mockExecuteActivateDeployment).toHaveBeenCalledTimes(1);
      expect(mockExecuteConfigureProxy).toHaveBeenCalledTimes(1);
      expect(mockExecuteCleanup).toHaveBeenCalledTimes(1);

      expect(deployments.updateCommit).toHaveBeenCalledWith(
        DEPLOYMENT_ID,
        'abc123',
        'initial commit',
      );
      expect(deployments.updateBuildImage).toHaveBeenCalledWith(
        DEPLOYMENT_ID,
        'app:latest',
      );
      expect(deployments.updateContainerId).toHaveBeenCalledWith(
        DEPLOYMENT_ID,
        '',
      );
      expect(deployments.markCompleted).toHaveBeenCalledWith(DEPLOYMENT_ID);
      expect(logService.append).toHaveBeenCalledWith(
        DEPLOYMENT_ID,
        LogLevel.SUCCESS,
        expect.stringContaining('live at'),
      );
      expect(logService.complete).toHaveBeenCalledWith(DEPLOYMENT_ID);
      expect(activity.log).toHaveBeenCalledWith(
        ActivityType.deployment_completed,
        OWNER_ID,
        { deploymentId: DEPLOYMENT_ID, environmentId: ENVIRONMENT_ID },
      );
    });

    it('skips the build steps when skipImageBuild is true', async () => {
      const job = buildJob({ skipImageBuild: true });

      await processor.process(job);

      expect(mockExecuteCloneRepository).not.toHaveBeenCalled();
      expect(mockExecuteResolveCommit).not.toHaveBeenCalled();
      expect(mockExecuteBuildImage).not.toHaveBeenCalled();
      expect(mockExecuteCreateContainer).toHaveBeenCalledTimes(1);
      expect(deployments.markCompleted).toHaveBeenCalledWith(DEPLOYMENT_ID);
    });

    it('sets the correct build status before each step executes', async () => {
      const job = buildJob({ skipImageBuild: true });

      await processor.process(job);

      const calls = deployments.updateBuildStatus.mock.calls.map(
        ([, status]: [string, BuildStatus]) => status,
      );

      expect(calls).toEqual([
        BuildStatus.building, // CreateContainer
        BuildStatus.deploying, // StartContainer
        BuildStatus.deploying, // HealthCheck
        BuildStatus.deploying, // ActivateDeployment
        BuildStatus.deploying, // ConfigureProxy
        BuildStatus.ready, // Cleanup
      ]);
    });
  });

  describe('process — abort handling', () => {
    it('stops the pipeline, cleans up, and does not mark completed when a deployment is aborted mid-run', async () => {
      deployments.findById
        .mockResolvedValueOnce({ buildStatus: BuildStatus.pending })
        .mockResolvedValueOnce({ buildStatus: BuildStatus.aborted });

      const job = buildJob({ skipImageBuild: true });

      await processor.process(job);

      expect(mockExecuteCreateContainer).toHaveBeenCalledTimes(1);
      expect(mockExecuteStartContainer).not.toHaveBeenCalled();
      expect(logService.append).toHaveBeenCalledWith(
        DEPLOYMENT_ID,
        LogLevel.INFO,
        'Deployment has been aborted.',
      );
      expect(logService.complete).toHaveBeenCalledWith(DEPLOYMENT_ID);
      expect(deployments.markCompleted).not.toHaveBeenCalled();
    });

    it('stops and removes the container during aborted cleanup when a containerId is already set', async () => {
      mockExecuteCreateContainer.mockImplementation(async (ctx: any) => {
        ctx.containerId = 'container-123';
      });

      deployments.findById
        .mockResolvedValueOnce({ buildStatus: BuildStatus.pending })
        .mockResolvedValueOnce({ buildStatus: BuildStatus.aborted });

      const job = buildJob({ skipImageBuild: true });

      await processor.process(job);

      expect(docker.stopContainer).toHaveBeenCalledWith('container-123');
      expect(docker.removeContainer).toHaveBeenCalledWith('container-123');
    });

    it('swallows errors when stopping/removing an already-gone container during aborted cleanup', async () => {
      mockExecuteCreateContainer.mockImplementation(async (ctx: any) => {
        ctx.containerId = 'container-123';
      });
      docker.stopContainer.mockRejectedValue(new Error('no such container'));

      deployments.findById
        .mockResolvedValueOnce({ buildStatus: BuildStatus.pending })
        .mockResolvedValueOnce({ buildStatus: BuildStatus.aborted });

      const job = buildJob({ skipImageBuild: true });

      await expect(processor.process(job)).resolves.toBeUndefined();
    });

    it('removes the workspace directory during aborted cleanup when one was set', async () => {
      mockExecuteCreateContainer.mockImplementation(async (ctx: any) => {
        ctx.workspace = '/tmp/workspace-1';
      });

      deployments.findById
        .mockResolvedValueOnce({ buildStatus: BuildStatus.pending })
        .mockResolvedValueOnce({ buildStatus: BuildStatus.aborted });

      const job = buildJob({ skipImageBuild: true });

      await processor.process(job);

      expect(rm).toHaveBeenCalledWith('/tmp/workspace-1', {
        recursive: true,
        force: true,
      });
    });
  });

  describe('process — step failure handling', () => {
    it('marks the deployment failed and logs the message for a DeploymentStepExecutionError', async () => {
      mockExecuteStartContainer.mockRejectedValue(
        new DeploymentStepExecutionError('container failed to start'),
      );

      const job = buildJob({ skipImageBuild: true });

      await processor.process(job);

      expect(deployments.markFailed).toHaveBeenCalledWith(
        DEPLOYMENT_ID,
        BuildStatus.deploying,
      );
      expect(deployments.markCompleted).toHaveBeenCalledWith(DEPLOYMENT_ID);
      expect(activity.log).toHaveBeenCalledWith(
        ActivityType.deployment_failed,
        OWNER_ID,
        { deploymentId: DEPLOYMENT_ID, environmentId: ENVIRONMENT_ID },
      );
      expect(logService.append).toHaveBeenCalledWith(
        DEPLOYMENT_ID,
        LogLevel.ERROR,
        'container failed to start',
      );
      expect(logService.complete).toHaveBeenCalledWith(DEPLOYMENT_ID);

      // pipeline stopped — later steps never ran
      expect(mockExecuteHealthCheck).not.toHaveBeenCalled();
    });

    it('records the building stage when the image build step fails', async () => {
      mockExecuteBuildImage.mockRejectedValue(
        new DeploymentStepExecutionError('railpack: command not found'),
      );

      const job = buildJob({ skipImageBuild: false });

      await processor.process(job);

      expect(deployments.markFailed).toHaveBeenCalledWith(
        DEPLOYMENT_ID,
        BuildStatus.building,
      );
    });

    it('rethrows and still marks the deployment failed for an unexpected (non-step) error', async () => {
      const unexpected = new Error('database error');
      mockExecuteStartContainer.mockRejectedValue(unexpected);

      const job = buildJob({ skipImageBuild: true });

      await expect(processor.process(job)).rejects.toThrow('database error');

      expect(deployments.markFailed).toHaveBeenCalledWith(
        DEPLOYMENT_ID,
        BuildStatus.deploying,
      );
      expect(deployments.markCompleted).toHaveBeenCalledWith(DEPLOYMENT_ID);
    });

    it('continues past a Cleanup step failure instead of treating it as fatal', async () => {
      mockExecuteCleanup.mockRejectedValue(new Error('cleanup failed'));

      const job = buildJob({ skipImageBuild: true });

      await processor.process(job);

      expect(deployments.markFailed).not.toHaveBeenCalled();
      expect(deployments.markCompleted).toHaveBeenCalledWith(DEPLOYMENT_ID);
      expect(logService.append).toHaveBeenCalledWith(
        DEPLOYMENT_ID,
        LogLevel.SUCCESS,
        expect.stringContaining('live at'),
      );
    });
  });

  describe('process — context building', () => {
    it('throws when the environment cannot be found', async () => {
      db.environment.findUnique.mockResolvedValue(null);

      const job = buildJob();

      await expect(processor.process(job)).rejects.toThrow(
        'Environment not found',
      );
    });
  });

  describe('process — variable loading', () => {
    it('loads and flattens environment variables as KEY=VALUE strings', async () => {
      db.environmentVariable.findMany.mockResolvedValue([
        { key: 'NODE_ENV', value: 'production' },
        { key: 'PORT', value: '3000' },
      ]);

      const job = buildJob({ skipImageBuild: true });

      await processor.process(job);

      expect(logService.append).toHaveBeenCalledWith(
        DEPLOYMENT_ID,
        LogLevel.INFO,
        '2 environment variables loaded',
      );
    });
  });

  describe('process — resource provisioning', () => {
    it('skips provisioning entirely when resourceCount is 0', async () => {
      const job = buildJob({ skipImageBuild: true, resourceCount: 0 });

      await processor.process(job);

      expect(db.resource.findMany).not.toHaveBeenCalled();
    });

    it('provisions resources and appends their credentials as variables when already ready', async () => {
      db.resource.findMany.mockResolvedValue([
        {
          id: 'resource-1',
          containerId: 'container-res-1',
          status: ResourceStatus.ready,
          credentials: { REDIS_URL: 'redis://localhost:6379' },
        },
      ]);

      const job = buildJob({ skipImageBuild: true, resourceCount: 1 });

      await processor.process(job);

      expect(docker.getOrCreateProjectNetwork).toHaveBeenCalledWith(
        'project-1',
      );
      expect(docker.connectContainerToNetwork).toHaveBeenCalledWith(
        'network-1',
        'container-res-1',
      );
      expect(logService.append).toHaveBeenCalledWith(
        DEPLOYMENT_ID,
        LogLevel.INFO,
        'Resource provisioning complete.',
      );
      expect(deployments.markCompleted).toHaveBeenCalledWith(DEPLOYMENT_ID);
    });

    it('polls until resources become ready, then continues the pipeline', async () => {
      db.resource.findMany
        .mockResolvedValueOnce([]) // not ready yet
        .mockResolvedValueOnce([]) // still not ready
        .mockResolvedValueOnce([
          { id: 'resource-1', status: ResourceStatus.ready, credentials: null },
        ]);

      const job = buildJob({ skipImageBuild: true, resourceCount: 1 });

      const promise = processor.process(job);

      await jest.advanceTimersByTimeAsync(10_000);
      await jest.advanceTimersByTimeAsync(10_000);

      await promise;

      expect(db.resource.findMany).toHaveBeenCalledTimes(3);
      expect(deployments.markCompleted).toHaveBeenCalledWith(DEPLOYMENT_ID);
    });

    it('fails the deployment with DeploymentStepExecutionError when provisioning times out', async () => {
      db.resource.findMany.mockResolvedValue([]);

      const job = buildJob({ skipImageBuild: true, resourceCount: 1 });

      const promise = processor.process(job);

      for (let i = 0; i < 14; i++) {
        await jest.advanceTimersByTimeAsync(10_000);
      }

      await promise;

      expect(deployments.markFailed).toHaveBeenCalledWith(
        DEPLOYMENT_ID,
        BuildStatus.pending,
      );
      expect(logService.append).toHaveBeenCalledWith(
        DEPLOYMENT_ID,
        LogLevel.ERROR,
        'Resource provisioning timed out.',
      );
      expect(mockExecuteCreateContainer).not.toHaveBeenCalled();
    });
  });
});
