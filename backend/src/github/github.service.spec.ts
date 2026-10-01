import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { getQueueToken } from '@nestjs/bullmq';
import { NotFoundException } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { GitHubService } from './github.service';
import { DbService } from '@src/db/db.service';
import { ActivityService } from '@src/activity/activity.service';
import { CleanupService } from '@src/cleanup/cleanup.service';
import { REDIS_CLIENT } from '@src/common/cache';

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'fake-jwt'),
}));

describe('GitHubService', () => {
  let service: GitHubService;
  let db: jest.Mocked<
    Pick<DbService, 'gitHubInstallation' | 'source' | 'deployment'>
  >;
  let activity: jest.Mocked<Pick<ActivityService, 'log'>>;
  let cleanup: jest.Mocked<Pick<CleanupService, 'enqueueProjectCleanup'>>;
  let cache: jest.Mocked<{ del: jest.Mock }>;
  let queue: jest.Mocked<Pick<Queue, 'add'>>;
  let redis: jest.Mocked<{ set: jest.Mock; get: jest.Mock; del: jest.Mock }>;
  let fetchSpy: jest.SpyInstance;

  beforeEach(async () => {
    db = {
      gitHubInstallation: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      source: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      deployment: {
        create: jest.fn(),
      },
    } as unknown as jest.Mocked<
      Pick<DbService, 'gitHubInstallation' | 'source' | 'deployment'>
    >;
    activity = { log: jest.fn() };
    cleanup = { enqueueProjectCleanup: jest.fn() };
    cache = { del: jest.fn() };
    queue = { add: jest.fn() };
    redis = { set: jest.fn(), get: jest.fn(), del: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GitHubService,
        { provide: DbService, useValue: db },
        { provide: ActivityService, useValue: activity },
        { provide: CleanupService, useValue: cleanup },
        { provide: CACHE_MANAGER, useValue: cache },
        { provide: getQueueToken('deployments'), useValue: queue },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    service = module.get(GitHubService);

    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('getInstallUrl', () => {
    it('stores the user behind a state token and returns the install URL', async () => {
      const url = await service.getInstallUrl('user-1');

      expect(url).toContain('https://github.com/apps/');
      expect(url).toMatch(/\/installations\/new\?state=.+/);
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^github:install:state:/),
        'user-1',
        { expiration: { type: 'EX', value: 600 } },
      );
    });
  });

  describe('handleInstallCallback', () => {
    it('returns the error URL when no state is provided', async () => {
      const url = await service.handleInstallCallback(12345, undefined);

      expect(url).toContain('github_install=error');
      expect(redis.get).not.toHaveBeenCalled();
    });

    it('returns the error URL when the state is not found or expired', async () => {
      redis.get.mockResolvedValue(null);

      const url = await service.handleInstallCallback(12345, 'bad-state');

      expect(url).toContain('github_install=error');
      expect(db.gitHubInstallation.findFirst).not.toHaveBeenCalled();
    });

    it('consumes the state and returns the connected URL for an existing installation', async () => {
      redis.get.mockResolvedValue('user-1');
      db.gitHubInstallation.findFirst = jest.fn().mockResolvedValue({
        id: 'inst-1',
        installationId: 12345,
      });

      const url = await service.handleInstallCallback(12345, 'good-state');

      expect(url).toContain('github_install=connected');
      expect(redis.del).toHaveBeenCalledWith(
        expect.stringMatching(/^github:install:state:/),
      );
      expect(db.gitHubInstallation.create).not.toHaveBeenCalled();
    });

    it('fetches installation details and creates a new installation', async () => {
      redis.get.mockResolvedValue('user-1');
      db.gitHubInstallation.findFirst = jest.fn().mockResolvedValue(null);
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            account: { login: 'octocat', type: 'User' },
          }),
      });

      const url = await service.handleInstallCallback(12345, 'good-state');

      expect(url).toContain('github_install=connected');
      expect(db.gitHubInstallation.create).toHaveBeenCalledWith({
        data: {
          installationId: 12345,
          accountLogin: 'octocat',
          accountType: 'User',
          userId: 'user-1',
        },
      });
      expect(activity.log).toHaveBeenCalledWith(
        'github_installation_added',
        'user-1',
        { installationId: 12345, accountLogin: 'octocat' },
      );
    });

    it('throws if fetching installation details from GitHub fails', async () => {
      redis.get.mockResolvedValue('user-1');
      db.gitHubInstallation.findFirst = jest.fn().mockResolvedValue(null);
      fetchSpy.mockResolvedValue({ ok: false, statusText: 'Not Found' });

      await expect(
        service.handleInstallCallback(12345, 'good-state'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUpdateAccessUrl', () => {
    it('clears repo and branch caches and returns settings URL after verifying ownership', async () => {
      db.gitHubInstallation.findFirst = jest.fn().mockResolvedValue({
        id: 'inst-1',
        installationId: 12345,
        userId: 'user-1',
      });
      db.source.findMany = jest
        .fn()
        .mockResolvedValue([
          { repositoryUrl: 'https://github.com/owner/repo-a' },
          { repositoryUrl: 'https://github.com/owner/repo-b' },
        ]);

      const url = await service.getUpdateAccessUrl(12345, 'user-1');

      expect(url).toBe('https://github.com/settings/installations/12345');
      expect(cache.del).toHaveBeenCalledWith(
        '/api/github/installations/12345/repositories',
      );
      expect(cache.del).toHaveBeenCalledWith(
        '/api/github/installations/12345/branches?repo=owner/repo-a',
      );
      expect(cache.del).toHaveBeenCalledWith(
        '/api/github/installations/12345/branches?repo=owner/repo-b',
      );
    });
  });

  describe('listInstallations', () => {
    it('queries by userId', async () => {
      db.gitHubInstallation.findMany = jest.fn().mockResolvedValue([]);
      await service.listInstallations('user-1');
      expect(db.gitHubInstallation.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });
  });

  describe('deleteInstallation', () => {
    it('revokes on GitHub, deletes related projects, and logs activity', async () => {
      db.gitHubInstallation.findFirst = jest.fn().mockResolvedValue({
        id: 'inst-1',
        installationId: 12345,
        userId: 'user-1',
      });
      fetchSpy.mockResolvedValue({ ok: true });
      db.source.findMany = jest
        .fn()
        .mockResolvedValue([{ projectId: 'proj-1' }, { projectId: 'proj-2' }]);

      await service.deleteInstallation(12345, 'user-1');

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.github.com/app/installations/12345',
        expect.objectContaining({ method: 'DELETE' }),
      );
      expect(db.gitHubInstallation.deleteMany).toHaveBeenCalledWith({
        where: { installationId: 12345 },
      });
      expect(cleanup.enqueueProjectCleanup).toHaveBeenCalledWith(
        'proj-1',
        'user-1',
      );
      expect(cleanup.enqueueProjectCleanup).toHaveBeenCalledWith(
        'proj-2',
        'user-1',
      );
      expect(activity.log).toHaveBeenCalledWith(
        'github_installation_removed',
        'user-1',
        { installationId: 12345 },
      );
    });

    it('throws if the installation is not owned by the caller', async () => {
      db.gitHubInstallation.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.deleteInstallation(12345, 'user-1')).rejects.toThrow(
        NotFoundException,
      );

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('throws and does not clean up if the GitHub API call fails', async () => {
      db.gitHubInstallation.findFirst = jest.fn().mockResolvedValue({
        id: 'inst-1',
        installationId: 12345,
        userId: 'user-1',
      });
      fetchSpy.mockResolvedValue({ ok: false, statusText: 'Forbidden' });

      await expect(service.deleteInstallation(12345, 'user-1')).rejects.toThrow(
        NotFoundException,
      );

      expect(db.gitHubInstallation.deleteMany).not.toHaveBeenCalled();
      expect(cleanup.enqueueProjectCleanup).not.toHaveBeenCalled();
    });
  });

  describe('listRepositories', () => {
    it('requests up to 100 repositories and returns them most-recently-added first', async () => {
      db.gitHubInstallation.findFirst = jest.fn().mockResolvedValue({
        id: 'inst-1',
        installationId: 12345,
        userId: 'user-1',
      });
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ token: 'installation-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              repositories: [
                { full_name: 'owner/repo-a' },
                { full_name: 'owner/repo-b' },
              ],
            }),
        });

      const result = await service.listRepositories(12345, 'user-1');

      expect(fetchSpy).toHaveBeenNthCalledWith(
        2,
        'https://api.github.com/installation/repositories?per_page=100',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer installation-token',
          }),
        }),
      );
      expect(result).toEqual([
        { full_name: 'owner/repo-b' },
        { full_name: 'owner/repo-a' },
      ]);
    });

    it('throws if the installation is not owned by the caller', async () => {
      db.gitHubInstallation.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.listRepositories(12345, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('throws when the repositories request fails', async () => {
      db.gitHubInstallation.findFirst = jest.fn().mockResolvedValue({
        id: 'inst-1',
        installationId: 12345,
        userId: 'user-1',
      });
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ token: 'installation-token' }),
        })
        .mockResolvedValueOnce({ ok: false, statusText: 'Forbidden' });

      await expect(service.listRepositories(12345, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('verifySignature', () => {
    it('returns false when no signature is provided', () => {
      expect(service.verifySignature(Buffer.from('payload'), '')).toBe(false);
    });

    it('returns false for a mismatched signature', () => {
      expect(
        service.verifySignature(Buffer.from('payload'), 'sha256=bogus'),
      ).toBe(false);
    });
  });

  describe('handlePushEvent', () => {
    it('creates a deployment and enqueues it for matching auto-deploy environments', async () => {
      db.source.findFirst = jest.fn().mockResolvedValue({
        project: {
          ownerId: 'user-1',
          environments: [
            { id: 'env-1', branch: 'main', autoDeploy: true },
            { id: 'env-2', branch: 'main', autoDeploy: false },
            { id: 'env-3', branch: 'dev', autoDeploy: true },
          ],
        },
      });
      db.deployment.create = jest
        .fn()
        .mockResolvedValue({ id: 'dep-1', trigger: 'webhook' });

      await service.handlePushEvent('refs/heads/main', 'owner/repo');

      expect(db.deployment.create).toHaveBeenCalledTimes(1);
      expect(db.deployment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ environmentId: 'env-1' }),
      });
      expect(queue.add).toHaveBeenCalledWith('webhook', {
        deployment: { id: 'dep-1', trigger: 'webhook' },
      });
      expect(activity.log).toHaveBeenCalledWith(
        'deployment_started',
        'user-1',
        expect.objectContaining({
          deploymentId: 'dep-1',
          environmentId: 'env-1',
        }),
      );
    });

    it('does nothing if no source matches the pushed repository', async () => {
      db.source.findFirst = jest.fn().mockResolvedValue(null);

      await service.handlePushEvent('refs/heads/main', 'owner/unknown');

      expect(db.deployment.create).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    });
  });
});
