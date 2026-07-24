import { rm } from 'fs/promises';
import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Logger } from '@src/common/logger';
import { ActivityType, LogLevel, BuildStatus } from '@generated/client';
import type { Deployment } from '@generated/client';
import { DockerService } from '@src/infrastructure/docker.service';
import { CommandService } from '@src/infrastructure/command.service';
import { CaddyService } from '@src/infrastructure/caddy.service';
import { DbService } from '@src/db/db.service';
import { LogService } from '@src/infrastructure/log.service';
import { ActivityService } from '@src/activity/activity.service';
import { DeploymentsService } from './deployments.service';
import {
  DeploymentContext,
  DeploymentJob,
  DeploymentStepName,
  DeploymentStepExecutionError,
  DeploymentStep,
} from '@src/common/types';
import { CloneRepositoryStep } from './pipeline/clone-repository.step';
import { ResolveCommitStep } from './pipeline/resolve-commit.step';
import { BuildImageStep } from './pipeline/build-image.step';
import { CreateContainerStep } from './pipeline/create-container.step';
import { StartContainerStep } from './pipeline/start-container.step';
import { HealthCheckStep } from './pipeline/health-check.step';
import { ConfigureProxyStep } from './pipeline/configure-proxy.step';
import { ActivateDeploymentStep } from './pipeline/activate-deployment.step';
import { CleanupStep } from './pipeline/cleanup.step';

@Processor('deployments')
export class DeploymentProcessor {
  private readonly logger = Logger(DeploymentProcessor.name);

  constructor(
    private readonly docker: DockerService,
    private readonly command: CommandService,
    private readonly caddy: CaddyService,
    private readonly db: DbService,
    private readonly logService: LogService,
    private readonly deployments: DeploymentsService,
    private readonly activity: ActivityService,
  ) {}

  @Process()
  async handleDeploy(job: Job<DeploymentJob>): Promise<void> {
    const { deployment, skipImageBuild } = job.data;
    const deploymentId = deployment.id;

    const ctx = await this.buildContext(deployment);

    await this.loadVariables(ctx);
    await this.provisionResources(ctx);

    const pipeline = this.buildPipeline(skipImageBuild);

    for (const step of pipeline) {
      const { buildStatus } = await this.deployments.findById(deploymentId);

      if (buildStatus === BuildStatus.aborted) {
        await this.logService.append(
          deploymentId,
          LogLevel.INFO,
          'Deployment was aborted.',
        );

        await this.cleanupAborted(ctx);
        this.logService.complete(deploymentId);
        return;
      }

      try {
        await this.deployments.updateBuildStatus(
          deploymentId,
          this.statusForStep(step.name),
        );

        await step.execute(ctx);
      } catch (error) {
        if (error instanceof DeploymentStepExecutionError) {
          await this.logService.append(
            deploymentId,
            LogLevel.ERROR,
            `[${step.name}] ${error.message}`,
          );

          await this.deployments.markFailed(deploymentId);
          this.logService.complete(deploymentId);

          await this.activity.log(
            ActivityType.deployment_failed,
            ctx.project.ownerId,
            { deploymentId, environmentId: ctx.environment.id },
          );
          return;
        }

        this.logger.error(
          `[${deploymentId}] System error during ${step.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    }

    await this.deployments.updateCommit(deploymentId, {
      commitSha: ctx.commitSha,
      commitMessage: ctx.commitMessage,
      imageTag: ctx.imageTag,
    });

    await this.deployments.updateContainerId(deploymentId, ctx.containerId);

    await this.logService.append(
      deploymentId,
      LogLevel.SUCCESS,
      `Congratulations! Your deployment is now live at ${ctx.domain}`,
    );

    await this.activity.log(
      ActivityType.deployment_completed,
      ctx.project.ownerId,
      { deploymentId, environmentId: ctx.environment.id },
    );

    this.logService.complete(deploymentId);
  }

  private async buildContext(
    deployment: Deployment,
  ): Promise<DeploymentContext> {
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
      new ConfigureProxyStep(
        this.caddy,
        this.db,
        this.logService,
        this.activity,
      ),
      new ActivateDeploymentStep(this.db),
      new CleanupStep(this.docker, this.caddy, this.db),
    ];

    if (skipImageBuild) return commonSteps;

    return [
      new CloneRepositoryStep(this.command, this.logService),
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

    ctx.variables = vars.map((v) => `${v.key}=${v.value}`);

    await this.logService.append(
      deploymentId,
      LogLevel.INFO,
      `${ctx.variables.length} environment variables loaded`,
    );
  }

  private async provisionResources(
    ctx: DeploymentContext,
    skipImageBuild?: boolean,
  ): Promise<void> {
    if (skipImageBuild) return;

    await this.logService.append(
      ctx.deployment.id,
      LogLevel.INFO,
      'Provisioning resources...',
    );

    const resources = await this.db.resource.findMany({
      where: { environmentId: ctx.environment.id, status: 'ready' },
    });

    for (const r of resources) {
      const creds = r.credentials as Record<string, string> | null;
      if (creds) {
        for (const [key, value] of Object.entries(creds)) {
          ctx.variables.push(`${key}=${value}`);
        }
      }
    }
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
