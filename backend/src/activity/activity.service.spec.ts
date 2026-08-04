import { Test, TestingModule } from '@nestjs/testing';
import { ActivityService } from './activity.service';
import { DbService } from '@src/db/db.service';
import { ActivityType } from '@generated/client';
import { FilterActivityLogsDto } from './dto/activity-log.dto';

describe('ActivityService', () => {
  let service: ActivityService;
  let db: jest.Mocked<Pick<DbService, 'activity'>>;

  function dto(overrides: Partial<FilterActivityLogsDto> = {}): FilterActivityLogsDto {
    return Object.assign(new FilterActivityLogsDto(), overrides);
  }

  beforeEach(async () => {
    db = {
      activity: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
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
    it('queries with actorId only', async () => {
      db.activity.findMany.mockResolvedValue([]);

      await service.findLogs('user-1', dto());

      expect(db.activity.findMany).toHaveBeenCalledWith({
        where: { AND: [{ actorId: 'user-1' }] },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(db.activity.count).toHaveBeenCalledWith({
        where: { AND: [{ actorId: 'user-1' }] },
      });
    });

    it('filters by exact type', async () => {
      await service.findLogs('user-1', dto({ type: 'project_created' }));

      expect(db.activity.findMany).toHaveBeenCalledWith({
        where: {
          AND: [
            { actorId: 'user-1' },
            { type: { equals: 'project_created' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('filters by wildcard type pattern', async () => {
      await service.findLogs('user-1', dto({ type: 'slack_*' }));

      expect(db.activity.findMany).toHaveBeenCalledWith({
        where: {
          AND: [
            { actorId: 'user-1' },
            { type: { startsWith: 'slack_' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('filters by projectId via metadata path', async () => {
      await service.findLogs('user-1', dto({ projectId: 'proj-1' }));

      expect(db.activity.findMany).toHaveBeenCalledWith({
        where: {
          AND: [
            { actorId: 'user-1' },
            { metadata: { path: ['projectId'], equals: 'proj-1' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('filters by multiple criteria', async () => {
      await service.findLogs('user-1', dto({
        type: 'deployment_*',
        projectId: 'proj-1',
      }));

      expect(db.activity.findMany).toHaveBeenCalledWith({
        where: {
          AND: [
            { actorId: 'user-1' },
            { type: { startsWith: 'deployment_' } },
            { metadata: { path: ['projectId'], equals: 'proj-1' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('filters by multiple entity criteria simultaneously', async () => {
      await service.findLogs('user-1', dto({
        projectId: 'proj-1',
        environmentId: 'env-1',
        deploymentId: 'dep-1',
      }));

      expect(db.activity.findMany).toHaveBeenCalledWith({
        where: {
          AND: [
            { actorId: 'user-1' },
            { metadata: { path: ['projectId'], equals: 'proj-1' } },
            { metadata: { path: ['environmentId'], equals: 'env-1' } },
            { metadata: { path: ['deploymentId'], equals: 'dep-1' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('paginates with page and limit', async () => {
      await service.findLogs('user-1', dto({ page: 3, limit: 10 }));

      expect(db.activity.findMany).toHaveBeenCalledWith({
        where: { AND: [{ actorId: 'user-1' }] },
        orderBy: { createdAt: 'desc' },
        skip: 20,
        take: 10,
      });
    });

    it('returns paginated result with data and meta', async () => {
      const logs = [{ id: 'a1', type: ActivityType.project_created, actorId: 'user-1', metadata: null, createdAt: new Date() }];
      db.activity.findMany.mockResolvedValue(logs);
      db.activity.count.mockResolvedValue(25);

      const result = await service.findLogs('user-1', dto({ page: 2, limit: 10 }));

      expect(result).toEqual({
        data: logs,
        meta: {
          total: 25,
          page: 2,
          limit: 10,
          totalPages: 3,
          hasNextPage: true,
          hasPrevPage: true,
        },
      });
    });

    it('sets hasNextPage to false on the last page', async () => {
      db.activity.findMany.mockResolvedValue([]);
      db.activity.count.mockResolvedValue(20);

      const result = await service.findLogs('user-1', dto({ page: 1, limit: 20 }));

      expect(result.meta.hasNextPage).toBe(false);
    });
  });
});
