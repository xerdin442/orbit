import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { DbService } from '@src/db/db.service';
import { EncryptionService } from '@src/infrastructure/encryption.service';
import { ActivityService } from '@src/activity/activity.service';
import {
  CreateEnvironmentDto,
  UpdateEnvironmentDto,
} from './dto/environment.dto';
import { CreateVariableDto, UpdateVariableDto } from './dto/variable.dto';
import {
  ActivityType,
  BuildStatus,
  DeploymentTrigger,
  LifecycleStatus,
} from '@generated/client';

@Injectable()
export class EnvironmentsService {
  constructor(
    private readonly db: DbService,
    private readonly encryption: EncryptionService,
    private readonly activity: ActivityService,
    @InjectQueue('deployments') private readonly deployQueue: Queue,
  ) {}

  private async verifyProjectOwnership(projectId: string, userId: string) {
    const project = await this.db.project.findFirst({
      where: { id: projectId, ownerId: userId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async create(projectId: string, userId: string, dto: CreateEnvironmentDto) {
    await this.verifyProjectOwnership(projectId, userId);

    const env = await this.db.environment.create({
      data: {
        name: dto.name,
        branch: dto.branch,
        autoDeploy: dto.autoDeploy ?? false,
        projectId,
      },
    });

    await this.activity.log(ActivityType.environment_created, userId, {
      projectId,
      environmentId: env.id,
    });

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

  async update(envId: string, userId: string, dto: UpdateEnvironmentDto) {
    await this.findById(envId, userId);

    const updated = await this.db.environment.update({
      where: { id: envId },
      data: dto,
    });

    await this.activity.log(ActivityType.environment_updated, userId, {
      projectId: updated.projectId,
      environmentId: envId,
    });

    return updated;
  }

  async delete(envId: string, userId: string) {
    const env = await this.findById(envId, userId);

    await this.db.environment.delete({ where: { id: envId } });

    await this.activity.log(ActivityType.environment_deleted, userId, {
      projectId: env.projectId,
      environmentId: envId,
    });
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

  async createVariable(envId: string, userId: string, dto: CreateVariableDto) {
    const env = await this.findById(envId, userId);

    const encrypted = this.encryption.encrypt(dto.value);

    const created = await this.db.environmentVariable.create({
      data: {
        key: dto.key,
        value: encrypted,
        environmentId: envId,
      },
    });

    await this.triggerRedeploy(envId);

    await this.activity.log(ActivityType.variable_created, userId, {
      projectId: env.projectId,
      environmentId: envId,
      key: dto.key,
    });

    return created;
  }

  async updateVariable(varId: string, userId: string, dto: UpdateVariableDto) {
    const existing = await this.db.environmentVariable.findUnique({
      where: { id: varId },
    });

    if (!existing) {
      throw new NotFoundException('Variable not found');
    }

    const env = await this.findById(existing.environmentId, userId);

    const encrypted = this.encryption.encrypt(dto.value);

    const updated = await this.db.environmentVariable.update({
      where: { id: varId },
      data: { value: encrypted },
    });

    await this.triggerRedeploy(existing.environmentId);

    await this.activity.log(ActivityType.variable_updated, userId, {
      projectId: env.projectId,
      environmentId: existing.environmentId,
      key: existing.key,
    });

    return updated;
  }

  async deleteVariable(varId: string, userId: string) {
    const existing = await this.db.environmentVariable.findUnique({
      where: { id: varId },
    });

    if (!existing) {
      throw new NotFoundException('Variable not found');
    }

    const env = await this.findById(existing.environmentId, userId);

    await this.db.environmentVariable.delete({ where: { id: varId } });

    await this.triggerRedeploy(existing.environmentId);

    await this.activity.log(ActivityType.variable_deleted, userId, {
      projectId: env.projectId,
      environmentId: existing.environmentId,
      key: existing.key,
    });
  }

  private async triggerRedeploy(environmentId: string) {
    const deployment = await this.db.deployment.create({
      data: {
        environmentId,
        trigger: DeploymentTrigger.redeploy,
        imageTag: '',
        commitSha: '',
        buildStatus: BuildStatus.pending,
        lifecycleStatus: LifecycleStatus.inactive,
      },
    });

    await this.deployQueue.add({ deploymentId: deployment.id });
  }
}
