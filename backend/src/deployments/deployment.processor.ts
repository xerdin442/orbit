import { rm } from 'fs/promises';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Job } from 'bullmq';
import { Logger } from '@src/common/logger';
import {
  ActivityType,
  LogLevel,
  BuildStatus,
  ResourceStatus,
} from '@generated/client';
import type { Deployment } from '@generated/client';
import { DockerService } from '@src/infrastructure/docker.service';
import { CommandService } from '@src/infrastructure/command.service';
import { CaddyService } from '@src/infrastructure/caddy.service';
import { DbService } from '@src/db/db.service';
import { LogService } from '@src/infrastructure/log.service';
import { ActivityService } from '@src/activity/activity.service';
import { GitHubService } from '@src/github/github.service';
import { EncryptionService } from '@src/infrastructure/encryption.service';
import { DeploymentsService } from './deployments.service';
import {
  DeploymentStatusChangedEvent,
  DeploymentCompletedEvent,
  DeploymentTerminatedEvent,
} from '@src/slack/events/deployment.events';
import {
  DeploymentContext,
  DeploymentJob,
  DeploymentStepName,
  DeploymentStepExecutionError,
  DeploymentStep,
} from '@src/common/types';
import {
  CreateContainerStep,
  StartContainerStep,
  HealthCheckStep,
  ActivateDeploymentStep,
  ConfigureProxyStep,
  CleanupStep,
  CloneRepositoryStep,
  ResolveCommitStep,
  BuildImageStep,
} from './pipeline';

@Processor('deployments')
export class DeploymentProcessor extends WorkerHost {
  private readonly logger = Logger(DeploymentProcessor.name);

  constructor(
    private readonly docker: DockerService,
    private readonly command: CommandService,
    private readonly caddy: CaddyService,
    private readonly db: DbService,
    private readonly logService: LogService,
    private readonly deployments: DeploymentsService,
    private readonly encryption: EncryptionService,
    private readonly activity: ActivityService,
    private readonly eventEmitter: EventEmitter2,
    private readonly github: GitHubService,
  ) {
    super();
  }

  async process(job: Job<DeploymentJob>): Promise<void> {
    const { deployment, skipImageBuild, resourceCount, slackMetadata } =
      job.data;
    const deploymentId = deployment.id;

    const ctx = await this.buildContext(deployment);

    await this.loadVariables(ctx);

    if (resourceCount && resourceCount > 0) {
      try {
        await this.provisionResources(ctx, resourceCount);
      } catch (error) {
        await this.handleError(
          ctx,
          error as Error,
          slackMetadata,
          BuildStatus.pending,
        );
        return;
      }
    }

    const pipeline = this.buildPipeline(skipImageBuild);

    for (const step of pipeline) {
      const { buildStatus } = await this.deployments.findById(
        deploymentId,
        ctx.project.ownerId,
      );

      if (buildStatus === BuildStatus.aborted) {
        await this.logService.append(
          deploymentId,
          LogLevel.INFO,
          'Deployment has been aborted.',
        );

        await this.cleanupAborted(ctx);
        this.logService.complete(deploymentId);

        this.eventEmitter.emit(
          'deployment.terminated',
          new DeploymentTerminatedEvent(
            ctx.deployment,
            ctx.project,
            ctx.environment,
            slackMetadata,
          ),
        );
        return;
      }

      const nextStatus = this.statusForStep(step.name);

      try {
        if (step.name === DeploymentStepName.BuildImage) {
          await this.deployments.updateCommit(
            deploymentId,
            ctx.commitSha,
            ctx.commitMessage,
          );
        }

        if (step.name === DeploymentStepName.CreateContainer) {
          await this.deployments.updateBuildImage(deploymentId, ctx.imageTag);
        }

        if (step.name === DeploymentStepName.ConfigureProxy) {
          await this.deployments.updateContainerId(
            deploymentId,
            ctx.containerId,
          );
        }

        await this.deployments.updateBuildStatus(deploymentId, nextStatus);

        if (nextStatus !== BuildStatus.ready) {
          this.eventEmitter.emit(
            'deployment.status.changed',
            new DeploymentStatusChangedEvent(
              ctx.deployment,
              ctx.project,
              ctx.environment,
              nextStatus,
              slackMetadata,
            ),
          );
        }

        await step.execute(ctx);
      } catch (error) {
        if (step.name === DeploymentStepName.Cleanup) break;
        await this.handleError(ctx, error as Error, slackMetadata, nextStatus);
        return;
      }
    }

    await this.deployments.markCompleted(deploymentId);

    await this.logService.append(
      deploymentId,
      LogLevel.SUCCESS,
      `Congratulations! Your deployment is now live at ${ctx.domain}`,
    );
    this.logService.complete(deploymentId);

    await this.activity.log(
      ActivityType.deployment_completed,
      ctx.project.ownerId,
      { deploymentId, environmentId: ctx.environment.id },
    );

    this.eventEmitter.emit(
      'deployment.completed',
      new DeploymentCompletedEvent(
        ctx.deployment,
        ctx.project,
        ctx.environment,
        ctx.domain,
        slackMetadata,
      ),
    );
  }

  private async buildContext(
    deployment: Deployment,
  ): Promise<DeploymentContext> {
    await this.logService.append(
      deployment.id,
      LogLevel.INFO,
      `Preparing deployment context...`,
    );

    const env = await this.db.environment.findUnique({
      where: { id: deployment.environmentId },
      include: { project: { include: { source: true } } },
    });

    if (!env) {
      throw new Error('Environment not found');
    }

    return {
      deployment,
      project: env.project,
      environment: env,
      workspace: '',
      imageTag: deployment.imageTag,
      commitSha: deployment.commitSha,
      commitMessage: deployment.commitMessage ?? '',
      containerId: '',
      domain: '',
      variables: [],
    };
  }

  private buildPipeline(skipImageBuild?: boolean): DeploymentStep[] {
    const commonSteps: DeploymentStep[] = [
      new CreateContainerStep(this.docker, this.logService),
      new StartContainerStep(this.docker, this.logService),
      new HealthCheckStep(this.docker, this.logService),
      new ActivateDeploymentStep(this.db),
      new ConfigureProxyStep(
        this.caddy,
        this.db,
        this.logService,
        this.activity,
      ),
      new CleanupStep(this.docker, this.db),
    ];

    if (skipImageBuild) return commonSteps;

    return [
      new CloneRepositoryStep(this.command, this.logService, this.github),
      new ResolveCommitStep(this.command, this.logService),
      new BuildImageStep(this.command, this.logService),
      ...commonSteps,
    ];
  }

  private async loadVariables(ctx: DeploymentContext): Promise<void> {
    const deploymentId = ctx.deployment.id;

    await this.logService.append(
      deploymentId,
      LogLevel.INFO,
      'Loading environment variables...',
    );

    const vars = await this.db.environmentVariable.findMany({
      where: { environmentId: ctx.environment.id },
    });

    ctx.variables = vars.map(
      (v) => `${v.key}=${this.encryption.decrypt(v.value)}`,
    );

    if (!vars.some((v) => v.key === 'PORT')) {
      ctx.variables.push(`PORT=${ctx.project.healthCheckPort}`);
    }

    const total = ctx.variables.length;
    await this.logService.append(
      deploymentId,
      LogLevel.INFO,
      `${total} environment variable${total === 1 ? '' : 's'} loaded.`,
    );
  }

  private async provisionResources(
    ctx: DeploymentContext,
    resourceCount: number,
  ): Promise<void> {
    const deploymentId = ctx.deployment.id;

    await this.logService.append(
      deploymentId,
      LogLevel.INFO,
      'Provisioning resources...',
    );

    const maxRetries = 20;
    const retryInterval = 10_000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const resources = await this.db.resource.findMany({
        where: { environmentId: ctx.environment.id },
      });

      const failed = resources.filter(
        (r) => r.status === ResourceStatus.failed,
      );
      if (failed.length > 0) {
        const names = failed.map((r) => r.name).join(', ');
        throw new DeploymentStepExecutionError(
          `Resource provisioning failed for: ${names}`,
        );
      }

      const ready = resources.filter((r) => r.status === ResourceStatus.ready);

      if (ready.length === resourceCount) {
        const network = await this.docker.getOrCreateProjectNetwork(
          ctx.project.id,
        );

        for (const r of ready) {
          if (r.containerId) {
            try {
              await this.docker.connectContainerToNetwork(
                network.id,
                r.containerId,
              );
            } catch {
              // container may already be connected
            }
          }

          const creds = r.credentials as Record<string, string> | null;
          if (creds) {
            for (const [key, value] of Object.entries(creds)) {
              ctx.variables.push(`${key}=${value}`);
            }
          }
        }

        await this.logService.append(
          deploymentId,
          LogLevel.INFO,
          'Resource provisioning complete.',
        );

        return;
      }

      if (attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, retryInterval));
      }
    }

    throw new DeploymentStepExecutionError('Resource provisioning timed out.');
  }

  private async cleanupAborted(ctx: DeploymentContext): Promise<void> {
    if (ctx.containerId) {
      try {
        await this.docker.stopContainer(ctx.containerId);
        await this.docker.removeContainer(ctx.containerId);
      } catch {
        // container already gone
      }
    }

    if (ctx.workspace) {
      await rm(ctx.workspace, { recursive: true, force: true });
    }
  }

  private async handleError(
    ctx: DeploymentContext,
    error: Error,
    slackMetadata?: DeploymentJob['slackMetadata'],
    failedStage?: BuildStatus,
  ): Promise<void> {
    await this.deployments.markFailed(ctx.deployment.id, failedStage);
    await this.deployments.markCompleted(ctx.deployment.id);

    await this.activity.log(
      ActivityType.deployment_failed,
      ctx.project.ownerId,
      { deploymentId: ctx.deployment.id, environmentId: ctx.environment.id },
    );

    if (error instanceof DeploymentStepExecutionError) {
      await this.logService.append(
        ctx.deployment.id,
        LogLevel.ERROR,
        error.message,
      );
      this.logService.complete(ctx.deployment.id);

      this.eventEmitter.emit(
        'deployment.terminated',
        new DeploymentTerminatedEvent(
          ctx.deployment,
          ctx.project,
          ctx.environment,
          slackMetadata,
        ),
      );
      return;
    }

    await this.logService.append(
      ctx.deployment.id,
      LogLevel.ERROR,
      'Internal server error',
    );
    this.logService.complete(ctx.deployment.id);

    this.eventEmitter.emit(
      'deployment.terminated',
      new DeploymentTerminatedEvent(
        ctx.deployment,
        ctx.project,
        ctx.environment,
        slackMetadata,
      ),
    );

    this.logger.error(
      `System error for deployment ${ctx.deployment.id}: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }

  private statusForStep(stepName: DeploymentStepName): BuildStatus {
    const map: Record<DeploymentStepName, BuildStatus> = {
      [DeploymentStepName.CloneRepository]: BuildStatus.cloning,
      [DeploymentStepName.ResolveCommit]: BuildStatus.building,
      [DeploymentStepName.BuildImage]: BuildStatus.building,
      [DeploymentStepName.CreateContainer]: BuildStatus.building,
      [DeploymentStepName.StartContainer]: BuildStatus.deploying,
      [DeploymentStepName.HealthCheck]: BuildStatus.deploying,
      [DeploymentStepName.ConfigureProxy]: BuildStatus.deploying,
      [DeploymentStepName.ActivateDeployment]: BuildStatus.deploying,
      [DeploymentStepName.Cleanup]: BuildStatus.ready,
    };

    return map[stepName] ?? BuildStatus.pending;
  }
}
