import { Test, TestingModule } from '@nestjs/testing';
import { GitHubService } from './github.service';
import { DbService } from '@src/db/db.service';
import { ActivityService } from '@src/activity/activity.service';

describe('GitHubService', () => {
  let service: GitHubService;
  let db: jest.Mocked<Pick<DbService, 'gitHubInstallation'>>;
  let activity: jest.Mocked<Pick<ActivityService, 'log'>>;

  beforeEach(async () => {
    db = {
      gitHubInstallation: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    activity = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GitHubService,
        { provide: DbService, useValue: db },
        { provide: ActivityService, useValue: activity },
      ],
    }).compile();

    service = module.get(GitHubService);
  });

  describe('getInstallUrl', () => {
    it('returns GitHub App install URL', () => {
      const url = service.getInstallUrl();
      expect(url).toContain('https://github.com/apps/');
      expect(url).toContain('/installations/new');
    });
  });

  describe('getUpdateAccessUrl', () => {
    it('returns settings URL with installationId after verifying ownership', async () => {
      db.gitHubInstallation.findFirst = jest.fn().mockResolvedValue({
        id: 'inst-1',
        installationId: 12345,
        userId: 'user-1',
      });
      const url = await service.getUpdateAccessUrl(12345, 'user-1');
      expect(url).toBe('https://github.com/settings/installations/12345');
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
});
