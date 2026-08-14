import { VercelProvider } from './vercel.provider';
import { NotFoundException } from '@nestjs/common';

describe('VercelProvider', () => {
  let provider: VercelProvider;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    provider = new VercelProvider();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('validateToken', () => {
    it('returns true when the token is accepted', async () => {
      fetchSpy.mockResolvedValue({ ok: true });

      await expect(provider.validateToken('tok')).resolves.toBe(true);
    });

    it('returns false when the token is rejected', async () => {
      fetchSpy.mockResolvedValue({ ok: false });

      await expect(provider.validateToken('tok')).resolves.toBe(false);
    });
  });

  describe('listProjects', () => {
    it('maps a github-linked project to a summary with repoFullName', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          projects: [
            {
              id: 'prj_1',
              name: 'my-app',
              link: { type: 'github', org: 'acme', repo: 'my-app' },
            },
          ],
          pagination: { next: null },
        }),
      });

      const result = await provider.listProjects('tok');

      expect(result).toEqual([
        { id: 'prj_1', name: 'my-app', repoFullName: 'acme/my-app' },
      ]);
    });

    it('maps a project with no git link to repoFullName: null', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          projects: [{ id: 'prj_2', name: 'cli-deployed' }],
          pagination: { next: null },
        }),
      });

      const result = await provider.listProjects('tok');

      expect(result).toEqual([
        { id: 'prj_2', name: 'cli-deployed', repoFullName: null },
      ]);
    });

    it('follows pagination until next is null', async () => {
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            projects: [{ id: 'prj_1', name: 'first' }],
            pagination: { next: 42 },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            projects: [{ id: 'prj_2', name: 'second' }],
            pagination: { next: null },
          }),
        });

      const result = await provider.listProjects('tok');

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(result.map((p) => p.id)).toEqual(['prj_1', 'prj_2']);
    });
  });

  describe('getProjectDetail', () => {
    it('assembles project detail, filtering env vars to the production target', async () => {
      fetchSpy.mockImplementation((input: string) => {
        if (input.includes('/env')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              envs: [
                {
                  key: 'DATABASE_URL',
                  value: 'postgres://prod',
                  target: ['production'],
                },
                { key: 'DEBUG', value: 'true', target: ['preview'] },
              ],
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 'prj_1',
            name: 'my-app',
            link: {
              type: 'github',
              org: 'acme',
              repo: 'my-app',
              productionBranch: 'main',
            },
            rootDirectory: 'apps/web',
            alias: ['my-app.vercel.app'],
          }),
        });
      });

      const result = await provider.getProjectDetail('tok', 'prj_1');

      expect(result).toEqual({
        id: 'prj_1',
        name: 'my-app',
        repoFullName: 'acme/my-app',
        defaultBranch: 'main',
        envVars: [{ key: 'DATABASE_URL', value: 'postgres://prod' }],
        domains: ['my-app.vercel.app'],
        buildDirectory: 'apps/web',
      });
    });

    it('throws NotFoundException when the project lookup fails', async () => {
      fetchSpy.mockResolvedValue({ ok: false, statusText: 'Not Found' });

      await expect(provider.getProjectDetail('tok', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
