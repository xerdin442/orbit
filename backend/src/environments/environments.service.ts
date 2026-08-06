import {
  Injectable,
  NotFoundException,
  Inject,
  ConflictException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Queue } from 'bullmq';
import type { DeploymentJob } from '@src/common/types';
import { DbService } from '@src/db/db.service';
import { EncryptionService } from '@src/infrastructure/encryption.service';
import { ActivityService } from '@src/activity/activity.service';
import { CleanupService } from '@src/cleanup/cleanup.service';
import {
  CreateEnvironmentDto,
  UpdateEnvironmentDto,
} from './dto/environment.dto';
import {
  CreateVariableDto,
  UpdateVariableDto,
  BulkCreateVariablesDto,
} from './dto/variable.dto';
import { ActivityType } from '@generated/client';
import { DeploymentsService } from '@src/deployments/deployments.service';

@Injectable()
export class EnvironmentsService {
  constructor(
    private readonly db: DbService,
    private readonly encryption: EncryptionService,
    private readonly activity: ActivityService,
    private readonly deployments: DeploymentsService,
    private readonly cleanup: CleanupService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @InjectQueue('deployments')
    private readonly deployQueue: Queue<DeploymentJob>,
  ) {}

  async create(projectId: string, userId: string, dto: CreateEnvironmentDto) {
    await this.verifyProjectOwnership(projectId, userId);

    await this.verifyUniqueBranch(projectId, dto.branch);

    const env = await this.db.environment.create({
      data: {
        name: dto.name,
        branch: dto.branch,
        autoDeploy: dto.autoDeploy ?? false,
        projectId,
      },
    });

    const deployment = await this.deployments.createDeployment(env.id, userId);

    await this.deployQueue.add('deploy', { deployment });

    await this.activity.log(ActivityType.environment_created, userId, {
      projectId,
      environmentId: env.id,
    });

    await this.invalidateEnvCache(projectId, env.id);

    return env;
  }

  async findById(envId: string, userId: string) {
    const env = await this.db.environment.findUnique({
      where: { id: envId },
    });

    if (!env) {
      throw new NotFoundException('Environment not found');
    }

    await this.verifyProjectOwnership(env.projectId, userId);

    return env;
  }

  async findAllByProject(projectId: string, userId: string) {
    await this.verifyProjectOwnership(projectId, userId);

    return this.db.environment.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async update(envId: string, userId: string, dto: UpdateEnvironmentDto) {
    const env = await this.findById(envId, userId);

    if (dto.branch) {
      await this.verifyUniqueBranch(env.projectId, dto.branch);
    }

    const updated = await this.db.environment.update({
      where: { id: envId },
      data: dto,
    });

    if (dto.branch) {
      const deployment = await this.deployments.createDeployment(
        updated.id,
        userId,
      );

      await this.deployQueue.add('deploy', { deployment });
    }

    await this.activity.log(ActivityType.environment_updated, userId, {
      projectId: updated.projectId,
      environmentId: envId,
    });

    await this.invalidateEnvCache(updated.projectId, envId);

    return updated;
  }

  async delete(envId: string, userId: string) {
    const env = await this.findById(envId, userId);

    await this.cleanup.enqueueEnvironmentCleanup(envId);

    await this.db.environment.delete({ where: { id: envId } });

    await this.activity.log(ActivityType.environment_deleted, userId, {
      projectId: env.projectId,
      environmentId: envId,
    });

    await this.invalidateEnvCache(env.projectId, envId);
  }

  async getVariables(envId: string, userId: string) {
    await this.findById(envId, userId);

    const vars = await this.db.environmentVariable.findMany({
      where: { environmentId: envId },
    });

    return vars.map((v) => ({
      ...v,
      value: this.encryption.decrypt(v.value),
    }));
  }

  async createVariable(
    envId: string,
    userId: string,
    dto: CreateVariableDto,
    skipRedeploy = false,
  ) {
    const env = await this.findById(envId, userId);

    const encrypted = this.encryption.encrypt(dto.value);

    const created = await this.db.environmentVariable.create({
      data: {
        key: dto.key,
        value: encrypted,
        environmentId: envId,
      },
    });

    if (!skipRedeploy) {
      await this.triggerRedeploy(envId, userId);
    }

    await this.invalidateEnvCache(env.projectId, envId, true);

    await this.activity.log(ActivityType.variable_created, userId, {
      projectId: env.projectId,
      environmentId: envId,
      key: dto.key,
    });

    return created;
  }

  async bulkCreateVariables(
    envId: string,
    userId: string,
    dto: BulkCreateVariablesDto,
    skipRedeploy = false,
  ) {
    const env = await this.findById(envId, userId);

    const data = dto.variables.map((v) => ({
      key: v.key,
      value: this.encryption.encrypt(v.value),
      environmentId: envId,
    }));

    const result = await this.db.environmentVariable.createMany({ data });

    if (!skipRedeploy) {
      await this.triggerRedeploy(envId, userId);
    }

    await this.invalidateEnvCache(env.projectId, envId, true);

    await this.activity.log(ActivityType.variable_created, userId, {
      projectId: env.projectId,
      environmentId: envId,
      keys: dto.variables.map((v) => v.key).join(','),
    });

    return { count: result.count };
  }

  async updateVariable(
    varId: string,
    userId: string,
    dto: UpdateVariableDto,
    skipRedeploy = false,
  ) {
    const existing = await this.db.environmentVariable.findUnique({
      where: { id: varId },
    });

    if (!existing) {
      throw new NotFoundException('Variable not found');
    }

    const encrypted = this.encryption.encrypt(dto.value);

    const updated = await this.db.environmentVariable.update({
      where: { id: varId },
      data: { value: encrypted },
      include: { environment: true },
    });

    const projectId = updated.environment.projectId;
    const envId = updated.environment.id;

    if (!skipRedeploy) {
      await this.triggerRedeploy(envId, userId);
    }

    await this.invalidateEnvCache(projectId, envId, true);

    await this.activity.log(ActivityType.variable_updated, userId, {
      projectId,
      environmentId: envId,
      key: existing.key,
    });

    return updated;
  }

  async deleteVariable(varId: string, userId: string, skipRedeploy = false) {
    const existing = await this.db.environmentVariable.findUnique({
      where: { id: varId },
      include: { environment: true },
    });

    if (!existing) {
      throw new NotFoundException('Variable not found');
    }

    const projectId = existing.environment.projectId;
    const envId = existing.environment.id;

    await this.db.environmentVariable.delete({ where: { id: varId } });

    if (!skipRedeploy) {
      await this.triggerRedeploy(envId, userId);
    }

    await this.invalidateEnvCache(projectId, envId, true);

    await this.activity.log(ActivityType.variable_deleted, userId, {
      projectId,
      environmentId: envId,
      key: existing.key,
    });
  }

  private async invalidateEnvCache(
    projectId: string,
    envId: string,
    variableChange = false,
  ) {
    await this.cache.del(`/api/projects/${projectId}/environments`);
    await this.cache.del(`/api/projects/${projectId}/environments/${envId}`);

    if (variableChange) {
      await this.cache.del(
        `/api/projects/${projectId}/environments/${envId}/variables`,
      );
    }
  }

  private async verifyProjectOwnership(projectId: string, userId: string) {
    const project = await this.db.project.findFirst({
      where: { id: projectId, ownerId: userId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  private async verifyUniqueBranch(projectId: string, branch: string) {
    const existing = await this.db.environment.findFirst({
      where: {
        projectId,
        branch,
      },
    });

    if (existing) {
      throw new ConflictException(
        'This branch is already connected to an environment',
      );
    }
  }

  private async triggerRedeploy(envId: string, userId: string) {
    const deployment = await this.deployments.triggerRedeployment(
      envId,
      userId,
    );

    await this.deployQueue.add('redeploy', {
      deployment,
      skipImageBuild: true,
    });
  }
}
