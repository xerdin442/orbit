import { RailwayProvider } from './railway.provider';
import { BadRequestException, NotFoundException } from '@nestjs/common';

function projectDetailResponse({
  id,
  name,
  services,
  triggers,
}: {
  id: string;
  name: string;
  services: { id: string; name: string }[];
  triggers: { serviceId: string; branch: string; repository: string }[];
}) {
  return {
    ok: true,
    json: async () => ({
      data: {
        project: {
          id,
          name,
          primaryEnvironmentId: 'env-1',
          services: { edges: services.map((node) => ({ node })) },
          environments: {
            edges: [
              {
                node: {
                  id: 'env-1',
                  name: 'production',
                  isEphemeral: false,
                  deploymentTriggers: {
                    edges: triggers.map((node) => ({ node })),
                  },
                },
              },
            ],
          },
        },
      },
    }),
  };
}

describe('RailwayProvider', () => {
  let provider: RailwayProvider;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    provider = new RailwayProvider();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('validateToken', () => {
    it('returns true when the query succeeds with no errors', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { projects: { edges: [] } } }),
      });

      await expect(provider.validateToken('tok')).resolves.toBe(true);
    });

    it('returns false when the API responds with GraphQL errors', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ errors: [{ message: 'Not Authorized' }] }),
      });

      await expect(provider.validateToken('tok')).resolves.toBe(false);
    });

    it('returns false when the request itself fails', async () => {
      fetchSpy.mockResolvedValue({ ok: false, statusText: 'Unauthorized' });

      await expect(provider.validateToken('tok')).resolves.toBe(false);
    });
  });

  describe('listProjects', () => {
    it('emits one entry with no groupLabel for a single-service project', async () => {
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              projects: {
                edges: [{ node: { id: 'proj-1', name: 'Proj One' } }],
              },
            },
          }),
        })
        .mockResolvedValueOnce(
          projectDetailResponse({
            id: 'proj-1',
            name: 'Proj One',
            services: [{ id: 'svc-1', name: 'web' }],
            triggers: [
              { serviceId: 'svc-1', branch: 'main', repository: 'acme/web' },
            ],
          }),
        );

      const result = await provider.listProjects('tok');

      expect(result).toEqual([
        {
          id: 'proj-1:env-1:svc-1',
          name: 'web',
          groupLabel: undefined,
          repoFullName: 'acme/web',
        },
      ]);
    });

    it('emits one entry per service, sharing a groupLabel, for a multi-service project', async () => {
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              projects: {
                edges: [{ node: { id: 'proj-1', name: 'Proj Three' } }],
              },
            },
          }),
        })
        .mockResolvedValueOnce(
          projectDetailResponse({
            id: 'proj-1',
            name: 'Proj Three',
            services: [
              { id: 'svc-1', name: 'api' },
              { id: 'svc-2', name: 'worker' },
              { id: 'svc-3', name: 'web' },
            ],
            triggers: [
              { serviceId: 'svc-1', branch: 'main', repository: 'acme/api' },
              { serviceId: 'svc-2', branch: 'main', repository: 'acme/worker' },
              { serviceId: 'svc-3', branch: 'main', repository: 'acme/web' },
            ],
          }),
        );

      const result = await provider.listProjects('tok');

      expect(result).toHaveLength(3);
      expect(result.every((r) => r.groupLabel === 'Proj Three')).toBe(true);
      expect(result.map((r) => r.name)).toEqual([
        'Proj Three / api',
        'Proj Three / worker',
        'Proj Three / web',
      ]);
    });

    it('excludes a service with no matching deploymentTrigger rather than emitting repoFullName: null', async () => {
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              projects: {
                edges: [{ node: { id: 'proj-1', name: 'Proj Two' } }],
              },
            },
          }),
        })
        .mockResolvedValueOnce(
          projectDetailResponse({
            id: 'proj-1',
            name: 'Proj Two',
            services: [
              { id: 'svc-1', name: 'api' },
              { id: 'svc-2', name: 'no-repo' },
            ],
            triggers: [
              { serviceId: 'svc-1', branch: 'main', repository: 'acme/api' },
            ],
          }),
        );

      const result = await provider.listProjects('tok');

      expect(result).toEqual([
        {
          id: 'proj-1:env-1:svc-1',
          name: 'api',
          groupLabel: undefined,
          repoFullName: 'acme/api',
        },
      ]);
    });
  });

  describe('getProjectDetail', () => {
    it('assembles service name, repo, branch, env vars and domains', async () => {
      fetchSpy
        .mockResolvedValueOnce(
          projectDetailResponse({
            id: 'proj-1',
            name: 'Proj One',
            services: [{ id: 'svc-1', name: 'web' }],
            triggers: [
              { serviceId: 'svc-1', branch: 'main', repository: 'acme/web' },
            ],
          }),
        )
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: { variables: { DATABASE_URL: 'postgres://old' } },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              domains: { customDomains: [{ domain: 'web.example.com' }] },
            },
          }),
        });

      const result = await provider.getProjectDetail(
        'tok',
        'proj-1:env-1:svc-1',
      );

      expect(result).toEqual({
        id: 'proj-1:env-1:svc-1',
        name: 'web',
        repoFullName: 'acme/web',
        defaultBranch: 'main',
        envVars: [{ key: 'DATABASE_URL', value: 'postgres://old' }],
        domains: ['web.example.com'],
      });
    });

    it('throws BadRequestException for a malformed id', async () => {
      await expect(
        provider.getProjectDetail('tok', 'not-a-composite-id'),
      ).rejects.toThrow(BadRequestException);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the project lookup fails', async () => {
      fetchSpy.mockImplementation((_input: unknown, init: RequestInit) => {
        const { query } = JSON.parse(init.body as string) as { query: string };

        if (query.includes('query project')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ errors: [{ message: 'not found' }] }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: { variables: {}, domains: { customDomains: [] } },
          }),
        });
      });

      await expect(
        provider.getProjectDetail('tok', 'proj-1:env-1:svc-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
