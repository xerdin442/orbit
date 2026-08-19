import { ProjectTokenGuard } from './project-token.guard';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { DbService } from '@src/db/db.service';
import { EncryptionService } from '@src/infrastructure/encryption.service';

describe('ProjectTokenGuard', () => {
  let guard: ProjectTokenGuard;
  let db: { project: { findUnique: jest.Mock } };
  let encryption: jest.Mocked<Pick<EncryptionService, 'hash'>>;

  beforeEach(() => {
    db = {
      project: { findUnique: jest.fn() },
    };
    encryption = { hash: jest.fn((v: string) => `hash_${v}`) };
    guard = new ProjectTokenGuard(
      db as unknown as DbService,
      encryption as unknown as EncryptionService,
    );
  });

  const mockContext = (headers: Record<string, unknown>): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
      }),
    }) as unknown as ExecutionContext;

  it('throws when no token header is present', async () => {
    await expect(guard.canActivate(mockContext({}))).rejects.toThrow(
      UnauthorizedException,
    );
    expect(db.project.findUnique).not.toHaveBeenCalled();
  });

  it('throws when the token header is not a string', async () => {
    await expect(
      guard.canActivate(mockContext({ 'x-project-token': ['a', 'b'] })),
    ).rejects.toThrow(UnauthorizedException);
    expect(db.project.findUnique).not.toHaveBeenCalled();
  });

  it('throws when no project matches the token hash', async () => {
    db.project.findUnique.mockResolvedValue(null);

    await expect(
      guard.canActivate(mockContext({ 'x-project-token': 'orbit_sat_abc' })),
    ).rejects.toThrow(UnauthorizedException);

    expect(encryption.hash).toHaveBeenCalledWith('orbit_sat_abc');
    expect(db.project.findUnique).toHaveBeenCalledWith({
      where: { secretAccessTokenHash: 'hash_orbit_sat_abc' },
    });
  });

  it('returns true and attaches the project to the request for a valid token', async () => {
    const project = { id: 'proj-1', ownerId: 'user-1' };
    db.project.findUnique.mockResolvedValue(project);

    const req: Record<string, unknown> = {
      headers: { 'x-project-token': 'orbit_sat_abc' },
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(req.project).toBe(project);
  });
});
