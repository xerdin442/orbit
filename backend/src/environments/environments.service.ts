import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { DbService } from '@src/db/db.service';
import { EncryptionService } from '@src/infrastructure/encryption.service';
import {
  CreateEnvironmentDto,
  UpdateEnvironmentDto,
} from './dto/environment.dto';
import { CreateVariableDto, UpdateVariableDto } from './dto/variable.dto';
import { Logger } from '@src/common/logger';
import {
  BuildStatus,
  DeploymentTrigger,
  LifecycleStatus,
} from '@generated/client';

@Injectable()
export class EnvironmentsService {
  private readonly logger = Logger(EnvironmentsService.name);

  constructor(
    private readonly db: DbService,
    private readonly encryption: EncryptionService,
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

    this.logger.info(
      `Environment created: ${env.id} (${env.name}) in project ${projectId}`,
    );

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

    this.logger.info(`Environment updated: ${envId}`);

    return updated;
  }

  async delete(envId: string, userId: string) {
    await this.findById(envId, userId);

    await this.db.environment.delete({ where: { id: envId } });

    this.logger.info(`Environment deleted: ${envId}`);
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
    await this.findById(envId, userId);

    const encrypted = this.encryption.encrypt(dto.value);

    const created = await this.db.environmentVariable.create({
      data: {
        key: dto.key,
        value: encrypted,
        environmentId: envId,
      },
    });

    await this.triggerRedeploy(envId);

    return created;
  }

  async updateVariable(varId: string, userId: string, dto: UpdateVariableDto) {
    const existing = await this.db.environmentVariable.findUnique({
      where: { id: varId },
    });

    if (!existing) {
      throw new NotFoundException('Variable not found');
    }

    await this.findById(existing.environmentId, userId);

    const encrypted = this.encryption.encrypt(dto.value);

    const updated = await this.db.environmentVariable.update({
      where: { id: varId },
      data: { value: encrypted },
    });

    await this.triggerRedeploy(existing.environmentId);

    return updated;
  }

  async deleteVariable(varId: string, userId: string) {
    const existing = await this.db.environmentVariable.findUnique({
      where: { id: varId },
    });

    if (!existing) {
      throw new NotFoundException('Variable not found');
    }

    await this.findById(existing.environmentId, userId);

    await this.db.environmentVariable.delete({ where: { id: varId } });

    await this.triggerRedeploy(existing.environmentId);
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

    this.logger.info(
      `Redeploy triggered for environment ${environmentId} due to variable change`,
    );
  }
}
