import { JwtAuthGuard } from './jwt-auth.guard';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwt: jest.Mocked<Pick<JwtService, 'verify'>>;

  beforeEach(() => {
    jwt = { verify: jest.fn() };
    guard = new JwtAuthGuard(jwt as JwtService);
  });

  const mockContext = (header?: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: header },
        }),
      }),
    }) as unknown as ExecutionContext;

  it('throws when no token', () => {
    expect(() => guard.canActivate(mockContext())).toThrow(
      UnauthorizedException,
    );
  });

  it('throws for non-Bearer token', () => {
    expect(() => guard.canActivate(mockContext('Basic abc123'))).toThrow(
      UnauthorizedException,
    );
  });

  it('throws for invalid token', () => {
    jwt.verify.mockImplementation(() => {
      throw new Error('jwt malformed');
    });

    expect(() => guard.canActivate(mockContext('Bearer invalid'))).toThrow(
      UnauthorizedException,
    );
  });

  it('returns true and sets user on request for valid token', () => {
    jwt.verify.mockReturnValue({ sub: 'user-1' });

    const req: Record<string, unknown> = {
      headers: { authorization: 'Bearer valid-token' },
    };
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as unknown as ExecutionContext;

    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(req.user).toEqual({ id: 'user-1' });
  });
});
