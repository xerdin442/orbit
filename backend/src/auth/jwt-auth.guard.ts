import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { Secrets } from '../common/secrets';
import { JwtPayload } from '@src/common/types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    try {
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: Secrets.JWT_SECRET,
      });

      (request as unknown as Record<string, unknown>).user = {
        id: payload.sub,
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    return true;
  }

  private extractToken(request: Request): string | null {
    const header = request.headers.authorization;

    if (!header) {
      return null;
    }

    const [type, token] = header.split(' ');

    if (type !== 'Bearer' || !token) {
      return null;
    }

    return token;
  }
}
