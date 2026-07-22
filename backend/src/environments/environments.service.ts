import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '@src/db/db.service';
import {
  CreateEnvironmentDto,
  UpdateEnvironmentDto,
} from './dto/environment.dto';
import { Logger } from '@src/common/logger';

@Injectable()
export class EnvironmentsService {
  private readonly logger = Logger(EnvironmentsService.name);

  constructor(private readonly db: DbService) {}

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
}
