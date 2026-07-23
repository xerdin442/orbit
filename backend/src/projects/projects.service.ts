import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import { DbService } from '@src/db/db.service';
import { EncryptionService } from '@src/infrastructure/encryption.service';
import { GitHubService } from '@src/github/github.service';
import { ActivityService } from '@src/activity/activity.service';
import { ActivityType } from '@generated/client';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly db: DbService,
    private readonly encryption: EncryptionService,
    private readonly github: GitHubService,
    private readonly activity: ActivityService,
  ) {}

  async create(userId: string, dto: CreateProjectDto) {
    const defaultBranch = dto.defaultBranch ?? 'main';

    const project = await this.db.$transaction(async (tx) => {
      const env = await tx.environment.create({
        data: {
          name: 'production',
          branch: defaultBranch,
          autoDeploy: true,
          project: {
            create: {
              name: dto.name.toLowerCase(),
              healthCheck: dto.healthCheck ?? false,
              ownerId: userId,
              source: {
                create: {
                  repositoryUrl: dto.repositoryUrl,
                  provider: 'github',
                  defaultBranch,
                  installationId: dto.installationId,
                },
              },
            },
          },
        },
        include: { project: { include: { source: true } } },
      });

      if (dto.envVars) {
        const vars = Object.entries(dto.envVars).map(([key, value]) => ({
          key,
          value: this.encryption.encrypt(value),
          environmentId: env.id,
        }));

        await tx.environmentVariable.createMany({ data: vars });
      }

      return env.project;
    });

    await this.activity.log(ActivityType.project_created, userId, {
      projectId: project.id,
    });

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
      data: {
        ...dto,
        name: dto.name?.toLowerCase(),
      },
      include: { source: true },
    });

    await this.activity.log(ActivityType.project_updated, userId, {
      projectId: id,
    });

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

    await this.activity.log(ActivityType.project_deleted, userId, {
      projectId: id,
    });
  }

  async findAvailableBranches(projectId: string) {
    const source = await this.db.source.findUniqueOrThrow({
      where: { projectId },
    });

    if (!source?.installationId) {
      return [];
    }

    const branches = await this.github.listBranches(
      source.installationId,
      source.repositoryUrl,
    );

    return branches.filter((b) => b.name !== source.defaultBranch);
  }
}
