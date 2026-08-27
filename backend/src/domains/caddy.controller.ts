import {
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { DbService } from '@src/db/db.service';
import { DomainStatus } from '@generated/client';
import { Logger } from '@src/common/logger';

@Controller('internal/caddy')
@SkipThrottle()
export class CaddyController {
  private readonly logger = Logger(CaddyController.name);

  constructor(private readonly db: DbService) {}

  @Get('tls-check')
  @HttpCode(200)
  async tlsCheck(@Query('domain') domain?: string): Promise<{ ok: true }> {
    const hostname = domain?.trim().toLowerCase();

    if (!hostname) {
      throw new NotFoundException('Missing domain');
    }

    const record = await this.db.domain.findFirst({
      where: { hostname, status: DomainStatus.active },
      select: { id: true },
    });

    if (!record) {
      this.logger.warn(
        `Denied on-demand TLS for unknown hostname: ${hostname}`,
      );
      throw new NotFoundException('Unknown domain');
    }

    return { ok: true };
  }
}
