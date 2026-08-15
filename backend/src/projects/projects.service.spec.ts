import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ProjectsService } from './projects.service';
import { DbService } from '@src/db/db.service';
import { EncryptionService } from '@src/infrastructure/encryption.service';
import { GitHubService } from '@src/github/github.service';
import { ActivityService } from '@src/activity/activity.service';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let db: jest.Mocked<Pick<DbService, '$transaction'>>;
  let tx: {
    environment: { create: jest.Mock };
    environmentVariable: { createMany: jest.Mock };
  };
  let encryption: jest.Mocked<Pick<EncryptionService, 'encrypt' | 'decrypt'>>;
  let activity: jest.Mocked<Pick<ActivityService, 'log'>>;

  const mockEnvironment = (healthCheckPort: number) => ({
    id: 'env-1',
    projectId: 'proj-1',
    project: {
      id: 'proj-1',
      name: 'my-app',
      healthCheckPort,
    },
  });

  beforeEach(async () => {
    tx = {
      environment: { create: jest.fn() },
      environmentVariable: { createMany: jest.fn() },
    };

    db = {
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(tx)),
    } as unknown as jest.Mocked<Pick<DbService, '$transaction'>>;

    encryption = {
      encrypt: jest.fn((v) => `enc_${v}`),
      decrypt: jest.fn((v) => v.replace('enc_', '')),
    };
    activity = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: DbService, useValue: db },
        { provide: EncryptionService, useValue: encryption },
        { provide: GitHubService, useValue: {} },
        { provide: ActivityService, useValue: activity },
        { provide: CACHE_MANAGER, useValue: { del: jest.fn() } },
      ],
    }).compile();

    service = module.get(ProjectsService);
  });

  describe('create', () => {
    it('uses the explicit healthCheckPort when provided, ignoring the PORT env var', async () => {
      tx.environment.create.mockResolvedValue(mockEnvironment(9090));

      await service.create('user-1', {
        name: 'my-app',
        repositoryUrl: 'https://github.com/owner/repo',
        defaultBranch: 'main',
        healthCheckPort: 9090,
        envVars: { PORT: '4000' },
      });

      expect(tx.environment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            project: expect.objectContaining({
              create: expect.objectContaining({ healthCheckPort: 9090 }),
            }),
          }),
        }),
      );
    });

    it('extracts the port from the PORT env var when healthCheckPort is not provided', async () => {
      tx.environment.create.mockResolvedValue(mockEnvironment(4000));

      await service.create('user-1', {
        name: 'my-app',
        repositoryUrl: 'https://github.com/owner/repo',
        defaultBranch: 'main',
        envVars: { PORT: '4000', NODE_ENV: 'production' },
      });

      expect(tx.environment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            project: expect.objectContaining({
              create: expect.objectContaining({ healthCheckPort: 4000 }),
            }),
          }),
        }),
      );
    });

    it('defaults to 3000 when neither healthCheckPort nor a PORT env var is provided', async () => {
      tx.environment.create.mockResolvedValue(mockEnvironment(3000));

      await service.create('user-1', {
        name: 'my-app',
        repositoryUrl: 'https://github.com/owner/repo',
        defaultBranch: 'main',
      });

      expect(tx.environment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            project: expect.objectContaining({
              create: expect.objectContaining({ healthCheckPort: 3000 }),
            }),
          }),
        }),
      );
    });

    it('defaults to 3000 when the PORT env var is not a valid positive integer', async () => {
      tx.environment.create.mockResolvedValue(mockEnvironment(3000));

      await service.create('user-1', {
        name: 'my-app',
        repositoryUrl: 'https://github.com/owner/repo',
        defaultBranch: 'main',
        envVars: { PORT: 'not-a-number' },
      });

      expect(tx.environment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            project: expect.objectContaining({
              create: expect.objectContaining({ healthCheckPort: 3000 }),
            }),
          }),
        }),
      );
    });
  });
});
