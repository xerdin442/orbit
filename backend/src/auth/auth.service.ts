import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '@src/users/users.service';
import { Secrets } from '@src/common/secrets';
import { REDIS_CLIENT } from '@src/common/cache';
import { ActivityService } from '@src/activity/activity.service';
import { ActivityType } from '@generated/client';
import type { GitHubTokenResponse, GitHubUser } from '@src/common/types';
import { createHash, randomUUID } from 'crypto';
import type { RedisClientType } from 'redis';

@Injectable()
export class AuthService {
  private readonly STATE_TTL_SECONDS = 600;

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly activity: ActivityService,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClientType,
  ) {}

  async getGitHubOAuthUrl(redirectUri?: string): Promise<{ url: string }> {
    const params = new URLSearchParams({
      client_id: Secrets.GITHUB_CLIENT_ID,
      redirect_uri: Secrets.GITHUB_REDIRECT_URI,
      scope: 'read:user',
    });

    if (redirectUri) {
      this.validateRedirectUri(redirectUri);
      const state = randomUUID();
      const stateKey = this.getStateKey(state);
      await this.redis.set(stateKey, redirectUri, {
        expiration: { type: 'EX', value: this.STATE_TTL_SECONDS },
      });
      params.set('state', state);
    }

    return {
      url: `https://github.com/login/oauth/authorize?${params.toString()}`,
    };
  }

  async handleGitHubCallback(code: string, state?: string): Promise<string> {
    const gitHubToken = await this.exchangeCodeForToken(code);
    const gitHubUser = await this.fetchGitHubUser(gitHubToken);

    let user = await this.users.findByGithubUserId(gitHubUser.id);

    if (!user) {
      user = await this.users.create({
        githubUserId: gitHubUser.id,
        githubUsername: gitHubUser.login,
        email: gitHubUser.email ?? undefined,
        avatarUrl: gitHubUser.avatar_url,
      });

      await this.activity.log(ActivityType.user_signed_up, user.id, {
        email: gitHubUser.email,
      });
    } else {
      await this.activity.log(ActivityType.user_signed_in, user.id, {
        email: gitHubUser.email,
      });
    }

    const jwt = this.jwt.sign({ sub: user.id });

    if (state) {
      const stateKey = this.getStateKey(state);
      const customRedirectUri = await this.redis.get(stateKey);

      if (customRedirectUri) {
        await this.redis.del(stateKey);
        return `${customRedirectUri}?source=github_redirect&token=${jwt}`;
      }
    }

    return `${Secrets.FRONTEND_URL}?source=github_redirect&token=${jwt}`;
  }

  async getAuthenticatedUser(userId: string) {
    const user = await this.users.findById(userId);

    return {
      id: user.id,
      githubUsername: user.githubUsername,
      email: user.email,
      avatarUrl: user.avatarUrl,
    };
  }

  private validateRedirectUri(uri: string) {
    if (
      uri.startsWith('http://localhost:') ||
      uri.startsWith('https://localhost:')
    ) {
      return;
    }

    if (uri === Secrets.FRONTEND_URL) {
      return;
    }

    throw new UnauthorizedException('Invalid redirect uri');
  }

  private getStateKey(state: string): string {
    return `github:oauth:state:${createHash('sha256').update(state).digest('hex')}`;
  }

  private async exchangeCodeForToken(code: string): Promise<string> {
    const body = JSON.stringify({
      client_id: Secrets.GITHUB_CLIENT_ID,
      client_secret: Secrets.GITHUB_CLIENT_SECRET,
      code,
    });

    const response = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body,
      },
    );

    if (!response.ok) {
      throw new UnauthorizedException('Failed to exchange code for token');
    }

    const data = (await response.json()) as GitHubTokenResponse;

    if (!data.access_token) {
      throw new UnauthorizedException('No access token received from GitHub');
    }

    return data.access_token;
  }

  private async fetchGitHubUser(token: string): Promise<GitHubUser> {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new UnauthorizedException('Failed to fetch GitHub user');
    }

    return (await response.json()) as GitHubUser;
  }
}
