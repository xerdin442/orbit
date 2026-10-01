import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '@src/users/users.service';
import { Secrets } from '@src/common/secrets';
import { ActivityService } from '@src/activity/activity.service';
import { ActivityType } from '@generated/client';
import type { GitHubTokenResponse, GitHubUser } from '@src/common/types';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly activity: ActivityService,
  ) {}

  getGitHubOAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: Secrets.GITHUB_CLIENT_ID,
      redirect_uri: Secrets.GITHUB_REDIRECT_URI,
      scope: 'read:user',
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async handleGitHubCallback(code: string): Promise<string> {
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

    return this.jwt.sign({ sub: user.id });
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
