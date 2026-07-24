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
    it('returns settings URL with installationId', () => {
      const url = service.getUpdateAccessUrl(12345);
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
