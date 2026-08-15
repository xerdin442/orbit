import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
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
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async create(userId: string, dto: CreateProjectDto) {
    if (dto.installationId) {
      await this.validateGitHubSource(
        userId,
        dto.installationId,
        dto.repositoryUrl,
        dto.defaultBranch,
      );
    }

    const healthCheckPort =
      dto.healthCheckPort ?? this.resolvePortFromEnvVars(dto.envVars);

    const environment = await this.db.$transaction(async (tx) => {
      const env = await tx.environment.create({
        data: {
          name: 'production',
          branch: dto.defaultBranch,
          autoDeploy: true,
          project: {
            create: {
              name: dto.name.toLowerCase(),
              healthCheck: dto.healthCheck ?? false,
              healthCheckPort,
              healthCheckPath: dto.healthCheckPath ?? '/health',
              healthCheckTimeout: dto.healthCheckTimeout ?? 60,
              buildDirectory: dto.buildDirectory,
              startCommand: dto.startCommand,
              ownerId: userId,
              source: {
                create: {
                  repositoryUrl: dto.repositoryUrl,
                  provider: 'github',
                  defaultBranch: dto.defaultBranch,
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

        await this.activity.log(ActivityType.variable_created, userId, {
          projectId: env.projectId,
          environmentId: env.id,
          keys: Object.keys(dto.envVars).join(','),
        });
      }

      return env;
    });

    await this.activity.log(ActivityType.project_created, userId, {
      projectId: environment.project.id,
    });

    await this.invalidateCache();

    return {
      environmentId: environment.id,
      project: environment.project,
    };
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
    await this.findById(id, userId);

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

    await this.invalidateCache(id);

    return updated;
  }

  async findAvailableBranches(projectId: string, userId: string) {
    const source = await this.db.source.findUniqueOrThrow({
      where: {
        projectId,
        project: {
          ownerId: userId,
        },
      },
    });

    if (!source?.installationId) {
      return [];
    }

    const branches = await this.github.listBranches(
      source.installationId,
      source.repositoryUrl,
      userId,
    );

    return branches.filter((b) => b.name !== source.defaultBranch);
  }

  private async validateGitHubSource(
    userId: string,
    installationId: number,
    repositoryUrl: string,
    defaultBranch: string,
  ) {
    const installation = await this.db.gitHubInstallation.findFirst({
      where: { installationId, userId },
    });

    if (!installation) {
      throw new NotFoundException('GitHub installation not found');
    }

    const repositories = await this.github.listRepositories(
      installationId,
      userId,
    );
    const repo = repositories.find(
      (r) => `https://github.com/${r.full_name}` === repositoryUrl,
    );

    if (!repo) {
      throw new NotFoundException(
        'Repository is not accessible through this installation',
      );
    }

    const branches = await this.github.listBranches(
      installationId,
      repositoryUrl,
      userId,
    );

    if (!branches.some((b) => b.name === defaultBranch)) {
      throw new NotFoundException(
        `Branch "${defaultBranch}" not found in repository`,
      );
    }
  }

  private resolvePortFromEnvVars(envVars?: Record<string, string>): number {
    const value = envVars?.PORT;
    if (!value) return 3000;

    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 3000;
  }

  private async invalidateCache(projectId?: string) {
    await this.cache.del('/api/projects');

    if (projectId) {
      await this.cache.del(`/api/projects/${projectId}`);
      await this.cache.del(`/api/projects/${projectId}/branches`);
    }
  }
}
