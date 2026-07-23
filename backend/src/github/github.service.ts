import { Injectable } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { Secrets } from '@src/common/secrets';
import { DbService } from '@src/db/db.service';
import { Logger } from '@src/common/logger';
import { GitHubAccountResponse, GitHubRepositoryList } from '@src/common/types';

@Injectable()
export class GitHubService {
  private readonly logger = Logger(GitHubService.name);

  constructor(private readonly db: DbService) {}

  getInstallUrl(): string {
    return `https://github.com/apps/${Secrets.GITHUB_APP_ID}/installations/new`;
  }

  getUpdateAccessUrl(installationId: number): string {
    return `https://github.com/settings/installations/${installationId}`;
  }

  async handleInstallCallback(installationId: number, userId: string) {
    const existing = await this.db.gitHubInstallation.findFirst({
      where: { installationId },
    });
    if (existing) return existing;

    const token = this.generateAppJwt();
    const response = await fetch(
      `https://api.github.com/app/installations/${installationId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch installation details: ${response.statusText}`,
      );
    }

    const data = (await response.json()) as GitHubAccountResponse;

    const install = await this.db.gitHubInstallation.create({
      data: {
        installationId,
        accountLogin: data.account.login,
        accountType: data.account.type,
        userId,
      },
    });

    this.logger.info(
      `GitHub installation created: ${installationId} (${data.account.login}) for user ${userId}`,
    );

    return install;
  }

  async listInstallations(userId: string) {
    return this.db.gitHubInstallation.findMany({
      where: { userId },
    });
  }

  async getInstallationToken(installationId: number): Promise<string> {
    const token = this.generateAppJwt();
    const response = await fetch(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to get installation token: ${response.statusText}`,
      );
    }

    const data = (await response.json()) as { token: string };
    return data.token;
  }

  async listRepositories(installationId: number) {
    const token = await this.getInstallationToken(installationId);

    const response = await fetch(
      'https://api.github.com/installation/repositories',
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to list repositories: ${response.statusText}`);
    }

    const data = (await response.json()) as GitHubRepositoryList;
    return data.repositories;
  }

  async listBranches(installationId: number, repositoryUrl: string) {
    const token = await this.getInstallationToken(installationId);

    const url = new URL(repositoryUrl);
    const [, owner, repo] = url.pathname.split('/');
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/branches`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to list branches: ${response.statusText}`);
    }

    const data = (await response.json()) as { name: string }[];
    return data;
  }

  private generateAppJwt(): string {
    return jwt.sign({}, Secrets.GITHUB_APP_PRIVATE_KEY, {
      algorithm: 'RS256',
      issuer: Secrets.GITHUB_APP_ID,
      expiresIn: 600,
    });
  }
}
