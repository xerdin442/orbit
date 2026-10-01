import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '@src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ActivityService } from '@src/activity/activity.service';
import { REDIS_CLIENT } from '@src/common/cache';
import { UnauthorizedException } from '@nestjs/common';
import { Secrets } from '@src/common/secrets';

jest.mock('@src/common/secrets', () => ({
  Secrets: {
    GITHUB_CLIENT_ID: 'test-client-id',
    GITHUB_CLIENT_SECRET: 'test-client-secret',
    GITHUB_REDIRECT_URI: 'http://api.local/auth/github/callback',
    FRONTEND_URL: 'http://frontend.local',
  },
}));

describe('AuthService', () => {
  let service: AuthService;
  let users: jest.Mocked<
    Pick<UsersService, 'findByGithubUserId' | 'create' | 'findById'>
  >;
  let jwt: jest.Mocked<Pick<JwtService, 'sign'>>;
  let activity: jest.Mocked<Pick<ActivityService, 'log'>>;
  let redis: jest.Mocked<{ set: jest.Mock; get: jest.Mock; del: jest.Mock }>;
  let fetchSpy: jest.SpyInstance;

  beforeEach(async () => {
    users = {
      findByGithubUserId: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
    };
    jwt = { sign: jest.fn().mockReturnValue('test-token') };
    activity = { log: jest.fn() };
    redis = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        { provide: JwtService, useValue: jwt },
        { provide: ActivityService, useValue: activity },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    service = module.get(AuthService);

    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('getGitHubOAuthUrl', () => {
    it('returns a valid GitHub OAuth URL without state when no redirect_uri', async () => {
      const { url } = await service.getGitHubOAuthUrl();

      expect(url).toContain('https://github.com/login/oauth/authorize');
      expect(url).toContain('client_id=');
      expect(url).toContain('redirect_uri=');
      expect(url).toContain('read%3Auser');
      expect(url).not.toContain('state=');
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('stores redirect_uri in Redis and includes state in URL', async () => {
      const { url } = await service.getGitHubOAuthUrl(
        'http://localhost:9090/callback',
      );

      expect(url).toContain('state=');
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^oauth:state:/),
        'http://localhost:9090/callback',
        { expiration: { type: 'EX', value: 600 } },
      );
    });

    it('accepts https localhost redirect_uri', async () => {
      const { url } = await service.getGitHubOAuthUrl(
        'https://localhost:3000/callback',
      );

      expect(url).toContain('state=');
      expect(redis.set).toHaveBeenCalled();
    });

    it('accepts FRONTEND_URL as redirect_uri', async () => {
      const { url } = await service.getGitHubOAuthUrl('http://frontend.local');

      expect(url).toContain('state=');
      expect(redis.set).toHaveBeenCalled();
    });

    it('throws for invalid redirect_uri', async () => {
      await expect(
        service.getGitHubOAuthUrl('http://evil.com/callback'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('handleGitHubCallback', () => {
    const githubUser = {
      id: 12345,
      login: 'testuser',
      email: 'test@example.com',
      avatar_url: 'https://avatar.url',
    };

    const dbUser = {
      id: 'user-1',
      githubUserId: 12345,
      githubUsername: 'testuser',
      email: 'test@example.com',
      avatarUrl: 'https://avatar.url',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: 'gh-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(githubUser),
        });

      users.findByGithubUserId.mockResolvedValue(dbUser);
    });

    it('returns FRONTEND_URL with token when no state is provided', async () => {
      const result = await service.handleGitHubCallback('auth-code');

      expect(result).toBe(
        'http://frontend.local?source=github_redirect&token=test-token',
      );
    });

    it('returns custom redirect_uri with token when valid state is provided', async () => {
      redis.get.mockResolvedValue('http://localhost:9090/callback');

      const result = await service.handleGitHubCallback(
        'auth-code',
        'state-uuid',
      );

      expect(redis.get).toHaveBeenCalledWith(
        expect.stringMatching(/^oauth:state:/),
      );
      expect(redis.del).toHaveBeenCalled();
      expect(result).toBe(
        'http://localhost:9090/callback?source=github_redirect&token=test-token',
      );
    });

    it('falls back to FRONTEND_URL when state is not found in Redis', async () => {
      redis.get.mockResolvedValue(null);

      const result = await service.handleGitHubCallback(
        'auth-code',
        'unknown-state',
      );

      expect(result).toBe(
        'http://frontend.local?source=github_redirect&token=test-token',
      );
    });

    it('creates a new user when not found', async () => {
      users.findByGithubUserId.mockResolvedValue(null);
      users.create.mockResolvedValue(dbUser);

      const result = await service.handleGitHubCallback('auth-code');

      expect(users.create).toHaveBeenCalledWith({
        githubUserId: 12345,
        githubUsername: 'testuser',
        email: 'test@example.com',
        avatarUrl: 'https://avatar.url',
      });
      expect(activity.log).toHaveBeenCalledWith(
        expect.stringContaining('user_signed_up'),
        'user-1',
        expect.any(Object),
      );
      expect(result).toContain('token=test-token');
    });

    it('throws when GitHub token exchange fails', async () => {
      fetchSpy.mockReset();
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({}),
      });

      await expect(
        service.handleGitHubCallback('bad-code'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getAuthenticatedUser', () => {
    it('returns user profile when found', async () => {
      users.findById.mockResolvedValue({
        id: 'user-1',
        githubUserId: 12345,
        githubUsername: 'testuser',
        email: 'test@example.com',
        avatarUrl: 'https://avatar.url',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.getAuthenticatedUser('user-1');

      expect(result).toEqual({
        id: 'user-1',
        githubUsername: 'testuser',
        email: 'test@example.com',
        avatarUrl: 'https://avatar.url',
      });
    });

    it('throws when user is not found', async () => {
      users.findById.mockRejectedValue(
        new UnauthorizedException('User not found'),
      );

      await expect(
        service.getAuthenticatedUser('nonexistent'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
