import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import { DbService } from '@src/db/db.service';
import { Logger } from '@src/common/logger';

@Injectable()
export class ProjectsService {
  private readonly logger = Logger(ProjectsService.name);

  constructor(private readonly db: DbService) {}

  async create(userId: string, dto: CreateProjectDto) {
    const defaultBranch = dto.defaultBranch ?? 'main';

    const project = await this.db.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          name: dto.name,
          ownerId: userId,
          source: {
            create: {
              repositoryUrl: dto.repositoryUrl,
              provider: 'github',
              defaultBranch,
            },
          },
          environments: {
            create: {
              name: 'Production',
              branch: defaultBranch,
              autoDeploy: true,
            },
          },
        },
        include: { source: true, environments: true },
      });

      return created;
    });

    this.logger.info(`Project created: ${project.id} by user ${userId}`);

    return project;
  }

  async findAllByUser(userId: string) {
    return this.db.project.findMany({
      where: { ownerId: userId },
      include: { source: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, userId: string) {
    const project = await this.db.project.findFirst({
      where: { id, ownerId: userId },
      include: { source: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async update(id: string, userId: string, dto: UpdateProjectDto) {
    const project = await this.db.project.findFirst({
      where: { id, ownerId: userId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const updated = await this.db.project.update({
      where: { id },
      data: { name: dto.name },
      include: { source: true },
    });

    this.logger.info(`Project updated: ${id}`);

    return updated;
  }

  async delete(id: string, userId: string) {
    const project = await this.db.project.findFirst({
      where: { id, ownerId: userId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    await this.db.project.delete({ where: { id } });

    this.logger.info(`Project deleted: ${id}`);
  }
}
