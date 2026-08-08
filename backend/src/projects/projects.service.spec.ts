import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ProjectsService } from './projects.service';
import { DbService } from '@src/db/db.service';
import { EncryptionService } from '@src/infrastructure/encryption.service';
import { GitHubService } from '@src/github/github.service';
import { ActivityService } from '@src/activity/activity.service';
import { NotFoundException } from '@nestjs/common';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let db: jest.Mocked<
    Pick<
      DbService,
      | 'project'
      | 'source'
      | 'environment'
      | 'environmentVariable'
      | 'gitHubInstallation'
      | '$transaction'
    >
  >;
  let encryption: jest.Mocked<Pick<EncryptionService, 'encrypt'>>;
  let github: jest.Mocked<
    Pick<GitHubService, 'listRepositories' | 'listBranches'>
  >;
  let activity: jest.Mocked<Pick<ActivityService, 'log'>>;

  beforeEach(async () => {
    db = {
      project: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findUnique: jest.fn(),
      },
      source: { findUniqueOrThrow: jest.fn() },
      gitHubInstallation: { findFirst: jest.fn() },
      environment: { create: jest.fn() },
      environmentVariable: { createMany: jest.fn() },
      $transaction: jest.fn(),
    } as unknown as jest.Mocked<
      Pick<
        DbService,
        | 'project'
        | 'source'
        | 'environment'
        | 'environmentVariable'
        | 'gitHubInstallation'
        | '$transaction'
      >
    >;

    encryption = { encrypt: jest.fn((v) => `encrypted_${v}`) };
    github = { listRepositories: jest.fn(), listBranches: jest.fn() };
    activity = { log: jest.fn() };

    (db.$transaction as jest.Mock).mockImplementation((cb: Function) => cb(db));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: DbService, useValue: db },
        { provide: EncryptionService, useValue: encryption },
        { provide: GitHubService, useValue: github },
        { provide: ActivityService, useValue: activity },
        { provide: CACHE_MANAGER, useValue: { del: jest.fn() } },
      ],
    }).compile();

    service = module.get(ProjectsService);
  });

  describe('findAllByUser', () => {
    it('queries projects by ownerId ordered by createdAt desc', async () => {
      db.project.findMany.mockResolvedValue([]);
      await service.findAllByUser('user-1');
      expect(db.project.findMany).toHaveBeenCalledWith({
        where: { ownerId: 'user-1' },
        include: { source: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findById', () => {
    it('returns project when found and owned', async () => {
      const mock = { id: 'proj-1', ownerId: 'user-1' };
      db.project.findFirst.mockResolvedValue(mock);

      const result = await service.findById('proj-1', 'user-1');
      expect(result).toBe(mock);
    });

    it('throws NotFoundException when not found', async () => {
      db.project.findFirst.mockResolvedValue(null);
      await expect(service.findById('proj-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('lowercases name and updates', async () => {
      db.project.findFirst.mockResolvedValue({
        id: 'proj-1',
        ownerId: 'user-1',
      });
      db.project.update.mockResolvedValue({ id: 'proj-1', name: 'updated' });

      await service.update('proj-1', 'user-1', { name: 'UPDATED' });

      expect(db.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'updated' }),
        }),
      );
      expect(activity.log).toHaveBeenCalled();
    });
  });

  describe('findAvailableBranches', () => {
    it('returns empty if no installationId', async () => {
      db.source.findUniqueOrThrow = jest.fn().mockResolvedValue({
        installationId: null,
        repositoryUrl: 'https://github.com/o/r',
        defaultBranch: 'main',
      });
      const result = await service.findAvailableBranches('proj-1', 'user-1');
      expect(result).toEqual([]);
    });
  });
});
