import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { DbService } from '@src/db/db.service';
import { EncryptionService } from '@src/infrastructure/encryption.service';
import { GitHubService } from '@src/github/github.service';
import { ActivityService } from '@src/activity/activity.service';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let db: {
    $transaction: jest.Mock;
    project: { findMany: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
  };
  let tx: {
    environment: { create: jest.Mock };
    environmentVariable: { createMany: jest.Mock };
  };
  let encryption: jest.Mocked<
    Pick<EncryptionService, 'encrypt' | 'decrypt' | 'hash'>
  >;
  let activity: jest.Mocked<Pick<ActivityService, 'log'>>;

  const mockEnvironment = (healthCheckPort: number) => ({
    id: 'env-1',
    projectId: 'proj-1',
    project: {
      id: 'proj-1',
      name: 'my-app',
      healthCheckPort,
      secretAccessToken: 'enc_orbit_sat_test',
      secretAccessTokenHash: 'hash_orbit_sat_test',
    },
  });

  beforeEach(async () => {
    tx = {
      environment: { create: jest.fn() },
      environmentVariable: { createMany: jest.fn() },
    };

    db = {
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(tx)),
      project: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    encryption = {
      encrypt: jest.fn((v) => `enc_${v}`),
      decrypt: jest.fn((v) => v.replace('enc_', '')),
      hash: jest.fn((v) => `hash_${v}`),
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

    it('generates a secret access token and stores its encrypted value and hash', async () => {
      tx.environment.create.mockResolvedValue(mockEnvironment(3000));

      await service.create('user-1', {
        name: 'my-app',
        repositoryUrl: 'https://github.com/owner/repo',
        defaultBranch: 'main',
      });

      const createArgs = tx.environment.create.mock.calls[0][0] as {
        data: {
          project: {
            create: {
              secretAccessToken: string;
              secretAccessTokenHash: string;
            };
          };
        };
      };
      const projectCreateData = createArgs.data.project.create;

      expect(encryption.hash).toHaveBeenCalledWith(
        expect.stringMatching(/^orbit_sat_[0-9a-f]{48}$/),
      );
      expect(projectCreateData.secretAccessToken).toMatch(
        /^enc_orbit_sat_[0-9a-f]{48}$/,
      );
      expect(projectCreateData.secretAccessTokenHash).toMatch(
        /^hash_orbit_sat_[0-9a-f]{48}$/,
      );
    });

    it('returns the project with the token decrypted and the hash stripped', async () => {
      tx.environment.create.mockResolvedValue(mockEnvironment(3000));

      const result = await service.create('user-1', {
        name: 'my-app',
        repositoryUrl: 'https://github.com/owner/repo',
        defaultBranch: 'main',
      });

      expect(result.project.secretAccessToken).toBe('orbit_sat_test');
      expect(result.project).not.toHaveProperty('secretAccessTokenHash');
    });
  });

  describe('findAllByUser', () => {
    it('serializes every project: strips the hash and decrypts the token', async () => {
      db.project.findMany.mockResolvedValue([
        {
          id: 'proj-1',
          name: 'app-a',
          secretAccessToken: 'enc_orbit_sat_a',
          secretAccessTokenHash: 'hash-a',
        },
        {
          id: 'proj-2',
          name: 'app-b',
          secretAccessToken: 'enc_orbit_sat_b',
          secretAccessTokenHash: 'hash-b',
        },
      ]);

      const result = await service.findAllByUser('user-1');

      expect(result).toEqual([
        { id: 'proj-1', name: 'app-a', secretAccessToken: 'orbit_sat_a' },
        { id: 'proj-2', name: 'app-b', secretAccessToken: 'orbit_sat_b' },
      ]);
    });
  });

  describe('findById', () => {
    it('serializes the project: strips the hash and decrypts the token', async () => {
      db.project.findFirst.mockResolvedValue({
        id: 'proj-1',
        name: 'app-a',
        secretAccessToken: 'enc_orbit_sat_a',
        secretAccessTokenHash: 'hash-a',
      });

      const result = await service.findById('proj-1', 'user-1');

      expect(result).toEqual({
        id: 'proj-1',
        name: 'app-a',
        secretAccessToken: 'orbit_sat_a',
      });
    });

    it('throws when the project is not found', async () => {
      db.project.findFirst.mockResolvedValue(null);

      await expect(service.findById('proj-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('serializes the updated project: strips the hash and decrypts the token', async () => {
      db.project.findFirst.mockResolvedValue({
        id: 'proj-1',
        name: 'app-a',
        secretAccessToken: 'enc_orbit_sat_a',
        secretAccessTokenHash: 'hash-a',
      });
      db.project.update.mockResolvedValue({
        id: 'proj-1',
        name: 'renamed',
        secretAccessToken: 'enc_orbit_sat_a',
        secretAccessTokenHash: 'hash-a',
      });

      const result = await service.update('proj-1', 'user-1', {
        name: 'Renamed',
      });

      expect(result).toEqual({
        id: 'proj-1',
        name: 'renamed',
        secretAccessToken: 'orbit_sat_a',
      });
    });
  });
});
