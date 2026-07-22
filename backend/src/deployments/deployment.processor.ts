import { rm } from 'fs/promises';
import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Logger } from '@src/common/logger';
import { LogLevel, BuildStatus } from '@generated/client';
import { DockerService } from '@src/infrastructure/docker.service';
import { CommandService } from '@src/infrastructure/command.service';
import { CaddyService } from '@src/infrastructure/caddy.service';
import { DbService } from '@src/db/db.service';
import { LogService } from './log.service';
import { DeploymentsService } from './deployments.service';
import {
  DeploymentContext,
  DeploymentJobData,
  DeploymentStepName,
  DeploymentStepExecutionError,
} from '@src/common/types';
import { CloneRepositoryStep } from './pipeline/clone-repository.step';
import { ResolveCommitStep } from './pipeline/resolve-commit.step';
import { BuildImageStep } from './pipeline/build-image.step';
import { ProvisionRuntimeStep } from './pipeline/provision-runtime.step';
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
  ) {}

  @Process()
  async handleDeploy(job: Job<DeploymentJobData>): Promise<void> {
    const { deploymentId } = job.data;

    const ctx = await this.buildContext(deploymentId);

    const steps = this.buildNormalPipeline();

    for (const step of steps) {
      const deployment = await this.deployments.findById(deploymentId);

      if (deployment.buildStatus === BuildStatus.aborted) {
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

        this.logger.info(`[${deploymentId}] ${step.name} completed`);
      } catch (error) {
        if (error instanceof DeploymentStepExecutionError) {
          this.logger.error(
            `[${deploymentId}] ${step.name} failed: ${error.message}`,
          );

          await this.logService.append(
            deploymentId,
            LogLevel.ERROR,
            `[${step.name}] ${error.message}`,
          );

          await this.deployments.markFailed(deploymentId);
          this.logService.complete(deploymentId);
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

    this.logger.info(`[${deploymentId}] Deployment completed`);

    this.logService.complete(deploymentId);
  }

  private async buildContext(deploymentId: string): Promise<DeploymentContext> {
    const deployment = await this.deployments.findById(deploymentId);
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
      imageTag: '',
      commitSha: '',
      commitMessage: '',
      containerId: '',
      networkId: '',
      domain: '',
      variables: {},
      resources: [],
    };
  }

  private buildNormalPipeline() {
    return [
      new ProvisionRuntimeStep(this.docker, this.db),
      new CloneRepositoryStep(this.command),
      new ResolveCommitStep(this.command),
      new BuildImageStep(this.command),
      new CreateContainerStep(this.docker),
      new StartContainerStep(this.docker),
      new HealthCheckStep(this.docker),
      new ConfigureProxyStep(this.caddy, this.db),
      new ActivateDeploymentStep(this.db),
      new CleanupStep(this.docker, this.caddy, this.db),
    ];
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
      [DeploymentStepName.ProvisionRuntime]: BuildStatus.provisioning,
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
