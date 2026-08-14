import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ExternalProjectDetail,
  ExternalProjectSummary,
  MigrationProvider,
} from './migration-provider.interface';
import type {
  VercelProjectLink,
  VercelProjectSummaryResponse,
  VercelProjectListResponse,
  VercelProjectDetailResponse,
  VercelEnvListResponse,
} from '@src/common/types/providers';

const VERCEL_API_BASE = 'https://api.vercel.com';
const PRODUCTION_TARGET = 'production';

@Injectable()
export class VercelProvider implements MigrationProvider {
  async validateToken(token: string): Promise<boolean> {
    const response = await fetch(`${VERCEL_API_BASE}/v2/user`, {
      headers: this.headers(token),
    });
    return response.ok;
  }

  async listProjects(token: string): Promise<ExternalProjectSummary[]> {
    const summaries: ExternalProjectSummary[] = [];
    let from: number | undefined;

    do {
      const url = new URL(`${VERCEL_API_BASE}/v10/projects`);
      url.searchParams.set('limit', '100');
      if (from) url.searchParams.set('from', String(from));

      const response = await fetch(url, { headers: this.headers(token) });
      if (!response.ok) {
        throw new Error(
          `Failed to list Vercel projects: ${response.statusText}`,
        );
      }

      const data = (await response.json()) as VercelProjectListResponse;
      summaries.push(...data.projects.map((p) => this.toSummary(p)));
      from = data.pagination?.next ?? undefined;
    } while (from);

    return summaries;
  }

  async getProjectDetail(
    token: string,
    id: string,
  ): Promise<ExternalProjectDetail> {
    const [project, envVars] = await Promise.all([
      this.fetchProject(token, id),
      this.fetchProductionEnvVars(token, id),
    ]);

    return {
      ...this.toSummary(project),
      defaultBranch: project.link?.productionBranch ?? null,
      envVars,
      domains: this.extractDomains(project.alias),
      buildDirectory: project.rootDirectory ?? undefined,
    };
  }

  private toSummary(
    project: VercelProjectSummaryResponse,
  ): ExternalProjectSummary {
    return {
      id: project.id,
      name: project.name,
      repoFullName: this.repoFullName(project.link),
    };
  }

  private repoFullName(link?: VercelProjectLink): string | null {
    if (!link || link.type !== 'github' || !link.org || !link.repo) {
      return null;
    }
    return `${link.org}/${link.repo}`;
  }

  private extractDomains(alias?: (string | { domain: string })[]): string[] {
    if (!alias) return [];
    return alias.map((a) => (typeof a === 'string' ? a : a.domain));
  }

  private async fetchProject(
    token: string,
    id: string,
  ): Promise<VercelProjectDetailResponse> {
    const response = await fetch(`${VERCEL_API_BASE}/v9/projects/${id}`, {
      headers: this.headers(token),
    });

    if (!response.ok) {
      throw new NotFoundException(
        `Vercel project not found: ${response.statusText}`,
      );
    }

    return (await response.json()) as VercelProjectDetailResponse;
  }

  private async fetchProductionEnvVars(
    token: string,
    id: string,
  ): Promise<{ key: string; value: string }[]> {
    const response = await fetch(
      `${VERCEL_API_BASE}/v10/projects/${id}/env?decrypt=true`,
      { headers: this.headers(token) },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch Vercel env vars: ${response.statusText}`,
      );
    }

    const data = (await response.json()) as VercelEnvListResponse;
    return data.envs
      .filter((env) => env.target.includes(PRODUCTION_TARGET))
      .map((env) => ({ key: env.key, value: env.value }));
  }

  private headers(token: string): Record<string, string> {
    return { Authorization: `Bearer ${token}` };
  }
}
