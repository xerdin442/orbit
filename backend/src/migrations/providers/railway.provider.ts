import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  ExternalProjectDetail,
  ExternalProjectSummary,
  MigrationProvider,
} from './migration-provider.interface';
import type {
  RailwayGraphQLResponse,
  RailwayDeploymentTrigger,
  RailwayProjectDetail,
  RailwayProjectListResponse,
  RailwayProjectDetailResponse,
  RailwayVariablesResponse,
  RailwayDomainsResponse,
  RailwayServiceInfo,
} from '@src/common/types/providers';

const RAILWAY_GRAPHQL_ENDPOINT = 'https://backboard.railway.com/graphql/v2';

const PROJECT_DETAIL_QUERY = `
  query project($id: String!) {
    project(id: $id) {
      id
      name
      primaryEnvironmentId
      services { edges { node { id name } } }
      environments {
        edges {
          node {
            id
            name
            isEphemeral
            deploymentTriggers {
              edges { node { serviceId branch repository provider } }
            }
          }
        }
      }
    }
  }
`;

@Injectable()
export class RailwayProvider implements MigrationProvider {
  async validateToken(token: string): Promise<boolean> {
    try {
      const result = await this.query<RailwayProjectListResponse>(
        token,
        'query { projects { edges { node { id } } } }',
      );
      return !result.errors;
    } catch {
      return false;
    }
  }

  async listProjects(token: string): Promise<ExternalProjectSummary[]> {
    const listResult = await this.query<RailwayProjectListResponse>(
      token,
      'query { projects { edges { node { id name } } } }',
    );

    if (listResult.errors || !listResult.data) {
      throw new Error(
        `Failed to list Railway projects: ${listResult.errors?.[0]?.message ?? 'unknown error'}`,
      );
    }

    const summaries: ExternalProjectSummary[] = [];

    for (const { node } of listResult.data.projects.edges) {
      const services = await this.listImportableServices(token, node.id);
      const groupLabel = services.length > 1 ? node.name : undefined;

      for (const service of services) {
        summaries.push({
          id: `${node.id}:${service.environmentId}:${service.serviceId}`,
          name: groupLabel ? `${node.name} / ${service.name}` : service.name,
          groupLabel,
          repoFullName: service.repoFullName,
        });
      }
    }

    return summaries;
  }

  async getProjectDetail(
    token: string,
    id: string,
  ): Promise<ExternalProjectDetail> {
    const [projectId, environmentId, serviceId] = this.parseId(id);

    const [service, envVars, domains] = await Promise.all([
      this.resolveService(token, projectId, environmentId, serviceId),
      this.fetchVariables(token, projectId, environmentId, serviceId),
      this.fetchDomains(token, projectId, environmentId, serviceId),
    ]);

    return {
      id,
      name: service.name,
      repoFullName: service.repoFullName,
      defaultBranch: service.branch,
      envVars,
      domains,
    };
  }

  private parseId(id: string): [string, string, string] {
    const parts = id.split(':');
    if (parts.length !== 3) {
      throw new BadRequestException(`Invalid Railway project id: ${id}`);
    }
    return parts as [string, string, string];
  }

  private async listImportableServices(
    token: string,
    projectId: string,
  ): Promise<RailwayServiceInfo[]> {
    const project = await this.fetchProjectDetail(token, projectId);

    const primaryEnv = project.environments.edges
      .map((e) => e.node)
      .find(
        (env) => env.id === project.primaryEnvironmentId && !env.isEphemeral,
      );

    if (!primaryEnv) return [];

    const triggersByService = new Map<string, RailwayDeploymentTrigger>();
    for (const { node: trigger } of primaryEnv.deploymentTriggers.edges) {
      triggersByService.set(trigger.serviceId, trigger);
    }

    const services: RailwayServiceInfo[] = [];
    for (const { node: service } of project.services.edges) {
      const trigger = triggersByService.get(service.id);
      if (!trigger) continue;

      services.push({
        serviceId: service.id,
        environmentId: primaryEnv.id,
        name: service.name,
        repoFullName: trigger.repository,
        branch: trigger.branch,
      });
    }

    return services;
  }

  private async resolveService(
    token: string,
    projectId: string,
    environmentId: string,
    serviceId: string,
  ): Promise<RailwayServiceInfo> {
    const project = await this.fetchProjectDetail(token, projectId);

    const service = project.services.edges
      .map((e) => e.node)
      .find((s) => s.id === serviceId);
    const environment = project.environments.edges
      .map((e) => e.node)
      .find((e) => e.id === environmentId);

    if (!service || !environment) {
      throw new NotFoundException(`Railway service ${serviceId} not found`);
    }

    const trigger = environment.deploymentTriggers.edges
      .map((e) => e.node)
      .find((t) => t.serviceId === serviceId);

    if (!trigger) {
      throw new NotFoundException(
        `Railway service ${serviceId} has no repository connection`,
      );
    }

    return {
      serviceId,
      environmentId,
      name: service.name,
      repoFullName: trigger.repository,
      branch: trigger.branch,
    };
  }

  private async fetchProjectDetail(
    token: string,
    projectId: string,
  ): Promise<RailwayProjectDetail> {
    const result = await this.query<RailwayProjectDetailResponse>(
      token,
      PROJECT_DETAIL_QUERY,
      { id: projectId },
    );

    if (result.errors || !result.data?.project) {
      throw new NotFoundException(
        `Railway project ${projectId} not found: ${result.errors?.[0]?.message ?? 'not found'}`,
      );
    }

    return result.data.project;
  }

  private async fetchVariables(
    token: string,
    projectId: string,
    environmentId: string,
    serviceId: string,
  ): Promise<{ key: string; value: string }[]> {
    const result = await this.query<RailwayVariablesResponse>(
      token,
      `query variables($projectId: String!, $environmentId: String!, $serviceId: String) {
        variables(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId, unrendered: false)
      }`,
      { projectId, environmentId, serviceId },
    );

    if (result.errors || !result.data) {
      throw new Error(
        `Failed to fetch Railway variables: ${result.errors?.[0]?.message ?? 'unknown error'}`,
      );
    }

    return Object.entries(result.data.variables).map(([key, value]) => ({
      key,
      value,
    }));
  }

  private async fetchDomains(
    token: string,
    projectId: string,
    environmentId: string,
    serviceId: string,
  ): Promise<string[]> {
    const result = await this.query<RailwayDomainsResponse>(
      token,
      `query domains($projectId: String!, $environmentId: String!, $serviceId: String!) {
        domains(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId) {
          customDomains { domain }
        }
      }`,
      { projectId, environmentId, serviceId },
    );

    if (result.errors || !result.data) {
      throw new Error(
        `Failed to fetch Railway domains: ${result.errors?.[0]?.message ?? 'unknown error'}`,
      );
    }

    return result.data.domains.customDomains.map((d) => d.domain);
  }

  private async query<T>(
    token: string,
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<RailwayGraphQLResponse<T>> {
    const response = await fetch(RAILWAY_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`Railway API request failed: ${response.statusText}`);
    }

    return (await response.json()) as RailwayGraphQLResponse<T>;
  }
}
