import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '@src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ActivityService } from '@src/activity/activity.service';

describe('AuthService', () => {
  let service: AuthService;
  let users: jest.Mocked<Pick<UsersService, 'findByGithubUserId' | 'create'>>;
  let jwt: jest.Mocked<Pick<JwtService, 'sign'>>;
  let activity: jest.Mocked<Pick<ActivityService, 'log'>>;

  beforeEach(async () => {
    users = { findByGithubUserId: jest.fn(), create: jest.fn() };
    jwt = { sign: jest.fn().mockReturnValue('test-token') };
    activity = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        { provide: JwtService, useValue: jwt },
        { provide: ActivityService, useValue: activity },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('getGitHubOAuthUrl', () => {
    it('returns a valid GitHub OAuth URL', () => {
      const url = service.getGitHubOAuthUrl();
      expect(url).toContain('https://github.com/login/oauth/authorize');
      expect(url).toContain('client_id=');
      expect(url).toContain('redirect_uri=');
      expect(url).toContain('read%3Auser');
    });
  });
});
