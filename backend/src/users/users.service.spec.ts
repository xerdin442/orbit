import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { DbService } from '@src/db/db.service';

describe('UsersService', () => {
  let service: UsersService;
  let db: jest.Mocked<Pick<DbService, 'user'>>;

  beforeEach(async () => {
    db = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    } as unknown as jest.Mocked<Pick<DbService, 'user'>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: DbService, useValue: db }],
    }).compile();

    service = module.get(UsersService);
  });

  describe('findByGithubUserId', () => {
    it('delegates to db.user.findUnique', async () => {
      const mockUser = { id: '1', githubUserId: 12345 };
      db.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByGithubUserId(12345);
      expect(result).toBe(mockUser);
      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: { githubUserId: 12345 },
      });
    });

    it('returns null when not found', async () => {
      db.user.findUnique.mockResolvedValue(null);
      const result = await service.findByGithubUserId(99999);
      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('delegates to db.user.findUnique', async () => {
      const mockUser = { id: 'abc', githubUserId: 12345 };
      db.user.findUnique.mockResolvedValue(mockUser);

      await service.findById('abc');
      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'abc' },
      });
    });
  });

  describe('create', () => {
    it('passes all fields to db.user.create', async () => {
      await service.create({
        githubUserId: 12345,
        githubUsername: 'testuser',
        email: 'test@example.com',
        avatarUrl: 'https://avatar.url',
      });

      expect(db.user.create).toHaveBeenCalledWith({
        data: {
          githubUserId: 12345,
          githubUsername: 'testuser',
          email: 'test@example.com',
          avatarUrl: 'https://avatar.url',
        },
      });
    });

    it('omits optional email and avatarUrl when undefined', async () => {
      await service.create({
        githubUserId: 12345,
        githubUsername: 'testuser',
      });

      expect(db.user.create).toHaveBeenCalledWith({
        data: {
          githubUserId: 12345,
          githubUsername: 'testuser',
        },
      });
    });
  });
});
