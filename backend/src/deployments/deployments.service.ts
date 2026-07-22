import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DbService } from '@src/db/db.service';
import {
  BuildStatus,
  LifecycleStatus,
  DeploymentTrigger,
} from '@generated/client';
import { Logger } from '@src/common/logger';

@Injectable()
export class DeploymentsService {
  private readonly logger = Logger(DeploymentsService.name);

  constructor(private readonly db: DbService) {}

  async createDeployment(environmentId: string, trigger: DeploymentTrigger) {
    const env = await this.db.environment.findUnique({
      where: { id: environmentId },
      include: {
        project: { include: { source: true } },
        variables: true,
        resources: true,
      },
    });

    if (!env) {
      throw new NotFoundException('Environment not found');
    }

    const active = await this.db.deployment.findFirst({
      where: {
        environmentId,
        buildStatus: { notIn: [BuildStatus.ready, BuildStatus.failed] },
        lifecycleStatus: { not: LifecycleStatus.aborted },
      },
    });

    if (active) {
      throw new ConflictException('A deployment is already in progress');
    }

    const deployment = await this.db.deployment.create({
      data: {
        environmentId,
        trigger,
        imageTag: '',
        commitSha: '',
        buildStatus: BuildStatus.pending,
        lifecycleStatus: LifecycleStatus.inactive,
      },
    });

    return deployment;
  }

  async findById(id: string) {
    const deployment = await this.db.deployment.findUnique({
      where: { id },
      include: { environment: true },
    });

    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }

    return deployment;
  }

  async findByEnvironment(environmentId: string) {
    return this.db.deployment.findMany({
      where: { environmentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findForRollback(deploymentId: string) {
    const deployment = await this.findById(deploymentId);

    if (
      deployment.lifecycleStatus !== LifecycleStatus.inactive &&
      deployment.buildStatus !== BuildStatus.ready
    ) {
      throw new BadRequestException(
        'Failed or running deployments cannot be rolled back',
      );
    }

    const rollbackDeployment = await this.db.deployment.create({
      data: {
        environmentId: deployment.environmentId,
        trigger: DeploymentTrigger.rollback,
        commitSha: deployment.commitSha,
        commitMessage: deployment.commitMessage,
        imageTag: deployment.imageTag,
        buildStatus: BuildStatus.pending,
        lifecycleStatus: LifecycleStatus.inactive,
      },
    });

    return rollbackDeployment;
  }

  async updateBuildStatus(id: string, buildStatus: BuildStatus) {
    return this.db.deployment.update({
      where: { id },
      data: { buildStatus },
    });
  }

  async updateCommit(
    id: string,
    data: { commitSha: string; commitMessage: string; imageTag: string },
  ) {
    return this.db.deployment.update({
      where: { id },
      data,
    });
  }

  async updateContainerId(id: string, containerId: string) {
    return this.db.deployment.update({
      where: { id },
      data: { containerId },
    });
  }

  async markFailed(id: string) {
    this.logger.info(`Deployment failed: ${id}`);

    return this.db.deployment.update({
      where: { id },
      data: {
        buildStatus: BuildStatus.failed,
        lifecycleStatus: LifecycleStatus.aborted,
      },
    });
  }
}
