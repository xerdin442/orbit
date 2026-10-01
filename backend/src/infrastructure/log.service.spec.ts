import { Test, TestingModule } from '@nestjs/testing';
import { LogService } from './log.service';
import { DbService } from '@src/db/db.service';
import { LogLevel, type DeploymentLog } from '@generated/client';

describe('LogService', () => {
  let service: LogService;
  let db: jest.Mocked<Pick<DbService, 'deploymentLog'>>;

  beforeEach(async () => {
    db = {
      deploymentLog: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    } as unknown as jest.Mocked<Pick<DbService, 'deploymentLog'>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [LogService, { provide: DbService, useValue: db }],
    }).compile();

    service = module.get(LogService);
  });

  describe('append', () => {
    it('persists to DB and emits to subscribers', async () => {
      const entry: DeploymentLog = {
        id: 'log-1',
        deploymentId: 'dep-1',
        timestamp: new Date(),
        level: LogLevel.INFO,
        message: 'test',
      };
      db.deploymentLog.create.mockResolvedValue(entry);

      const received: DeploymentLog[] = [];
      service.subscribe('dep-1').subscribe((e) => received.push(e));

      await service.append('dep-1', LogLevel.INFO, 'test');

      expect(db.deploymentLog.create).toHaveBeenCalledWith({
        data: { deploymentId: 'dep-1', level: LogLevel.INFO, message: 'test' },
      });
      expect(received).toHaveLength(1);
      expect(received[0].message).toBe('test');
    });
  });

  describe('subscribe', () => {
    it('returns the same stream for the same deploymentId', () => {
      const a = service.subscribe('dep-1');
      const b = service.subscribe('dep-1');
      expect(a).toBe(b);
    });

    it('returns different streams for different deploymentIds', () => {
      const a = service.subscribe('dep-1');
      const b = service.subscribe('dep-2');
      expect(a).not.toBe(b);
    });
  });

  describe('complete', () => {
    it('closes and removes the stream', () => {
      const stream = service.subscribe('dep-1');
      let completed = false;
      stream.subscribe({ complete: () => (completed = true) });

      service.complete('dep-1');
      expect(completed).toBe(true);
    });

    it('is idempotent', () => {
      service.subscribe('dep-1');
      service.complete('dep-1');
      expect(() => service.complete('dep-1')).not.toThrow();
    });
  });

  describe('getLogs', () => {
    it('returns logs ordered by timestamp', async () => {
      db.deploymentLog.findMany.mockResolvedValue([]);
      await service.getLogs('dep-1');
      expect(db.deploymentLog.findMany).toHaveBeenCalledWith({
        where: { deploymentId: 'dep-1' },
        orderBy: { timestamp: 'asc' },
      });
    });
  });
});
