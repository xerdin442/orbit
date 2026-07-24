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
  ActivityType,
} from '@generated/client';
import { ResourcesService } from '@src/resources/resources.service';
import { ActivityService } from '@src/activity/activity.service';

@Injectable()
export class DeploymentsService {
  constructor(
    private readonly db: DbService,
    private readonly activity: ActivityService,
    private readonly resources: ResourcesService,
  ) {}

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

    const created = await this.db.deployment.create({
      data: {
        environmentId,
        trigger,
        imageTag: '',
        commitSha: '',
        buildStatus: BuildStatus.pending,
        lifecycleStatus: LifecycleStatus.inactive,
      },
    });

    await this.activity.log(
      ActivityType.deployment_started,
      env.project.ownerId,
      { deploymentId: created.id, environmentId, trigger: trigger },
    );

    return created;
  }

  async findById(id: string) {
    const deployment = await this.db.deployment.findUnique({
      where: { id },
      include: {
        environment: { include: { project: true } },
      },
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

    const rolledDeployment = await this.db.deployment.create({
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

    await this.activity.log(
      ActivityType.deployment_rolled_back,
      deployment.environment.project.ownerId,
      {
        deploymentId: rolledDeployment.id,
        environmentId: deployment.environmentId,
        trigger: DeploymentTrigger.rollback,
      },
    );

    return rolledDeployment;
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
    return this.db.deployment.update({
      where: { id },
      data: {
        buildStatus: BuildStatus.failed,
        lifecycleStatus: LifecycleStatus.aborted,
      },
    });
  }

  async abortDeployment(id: string, resourceIds?: string) {
    const deployment = await this.db.deployment.update({
      where: { id },
      data: { buildStatus: BuildStatus.aborted },
      include: {
        environment: { include: { project: true } },
      },
    });

    const userId = deployment.environment.project.ownerId;

    await this.activity.log(ActivityType.deployment_aborted, userId, {
      deploymentId: id,
      environmentId: deployment.environmentId,
    });

    if (resourceIds) {
      const ids = resourceIds.trim().split(',');
      for (const resourceId of ids) {
        try {
          await this.resources.delete(resourceId, userId);
        } catch {
          // resource already gone or never created
        }
      }
    }

    return deployment;
  }
}
