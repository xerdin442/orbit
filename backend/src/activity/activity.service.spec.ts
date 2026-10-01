import { Test, TestingModule } from '@nestjs/testing';
import { ActivityService } from './activity.service';
import { DbService } from '@src/db/db.service';
import { ActivityType } from '@generated/client';

describe('ActivityService', () => {
  let service: ActivityService;
  let db: jest.Mocked<Pick<DbService, 'activity'>>;

  beforeEach(async () => {
    db = {
      activity: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    } as unknown as jest.Mocked<Pick<DbService, 'activity'>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [ActivityService, { provide: DbService, useValue: db }],
    }).compile();

    service = module.get(ActivityService);
  });

  describe('log', () => {
    it('creates activity with type, actorId, metadata', async () => {
      await service.log(ActivityType.project_created, 'user-1', {
        projectId: 'proj-1',
      });

      expect(db.activity.create).toHaveBeenCalledWith({
        data: {
          type: ActivityType.project_created,
          actorId: 'user-1',
          metadata: { projectId: 'proj-1' },
        },
      });
    });

    it('creates activity without metadata', async () => {
      await service.log(ActivityType.user_signed_in, 'user-1');

      expect(db.activity.create).toHaveBeenCalledWith({
        data: {
          type: ActivityType.user_signed_in,
          actorId: 'user-1',
          metadata: undefined,
        },
      });
    });
  });

  describe('findLogs', () => {
    it('queries with no filters when no options', async () => {
      db.activity.findMany.mockResolvedValue([]);
      await service.findLogs();
      expect(db.activity.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
      });
    });

    it('filters by actorId', async () => {
      await service.findLogs({ actorId: 'user-1' });
      expect(db.activity.findMany).toHaveBeenCalledWith({
        where: { actorId: 'user-1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('filters by exact type', async () => {
      await service.findLogs({ type: 'project_created' });
      expect(db.activity.findMany).toHaveBeenCalledWith({
        where: { type: { equals: 'project_created' } },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('filters by wildcard type pattern', async () => {
      await service.findLogs({ type: 'slack_*' });
      expect(db.activity.findMany).toHaveBeenCalledWith({
        where: { type: { startsWith: 'slack_' } },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('filters by wildcard type pattern with nested prefix', async () => {
      await service.findLogs({ type: 'github_*' });
      expect(db.activity.findMany).toHaveBeenCalledWith({
        where: { type: { startsWith: 'github_' } },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('filters by projectId via metadata path', async () => {
      await service.findLogs({ projectId: 'proj-1' });
      expect(db.activity.findMany).toHaveBeenCalledWith({
        where: {
          metadata: { path: ['projectId'], equals: 'proj-1' },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('filters by deploymentId', async () => {
      await service.findLogs({ deploymentId: 'dep-1' });
      expect(db.activity.findMany).toHaveBeenCalledWith({
        where: {
          metadata: { path: ['deploymentId'], equals: 'dep-1' },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('filters by multiple criteria', async () => {
      await service.findLogs({
        actorId: 'user-1',
        type: 'deployment_*',
        projectId: 'proj-1',
      });
      expect(db.activity.findMany).toHaveBeenCalledWith({
        where: {
          actorId: 'user-1',
          type: { startsWith: 'deployment_' },
          metadata: { path: ['projectId'], equals: 'proj-1' },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
