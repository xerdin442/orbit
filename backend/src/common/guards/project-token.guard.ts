import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { DbService } from '@src/db/db.service';
import { EncryptionService } from '@src/infrastructure/encryption.service';

@Injectable()
export class ProjectTokenGuard implements CanActivate {
  constructor(
    private readonly db: DbService,
    private readonly encryption: EncryptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.headers['x-project-token'];

    if (typeof token !== 'string' || !token) {
      throw new UnauthorizedException('Missing project access token');
    }

    const project = await this.db.project.findUnique({
      where: { secretAccessTokenHash: this.encryption.hash(token) },
    });

    if (!project) {
      throw new UnauthorizedException('Invalid project access token');
    }

    (request as unknown as Record<string, unknown>).project = project;

    return true;
  }
}
