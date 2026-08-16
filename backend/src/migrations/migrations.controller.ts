import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MigrationsService } from './migrations.service';
import { JwtAuthGuard } from '@src/auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '@src/common/types';
import { ParseExternalProviderPipe } from '@src/common/pipes/external-provider.pipe';
import { ExternalProvider } from '@generated/client';
import { ConnectProviderDto } from './dto/connect-provider.dto';

@Controller('migrations')
@UseGuards(JwtAuthGuard)
export class MigrationsController {
  constructor(private readonly migrations: MigrationsService) {}

  @Post(':provider/connect')
  @HttpCode(HttpStatus.OK)
  connect(
    @Req() req: AuthenticatedRequest,
    @Param('provider', ParseExternalProviderPipe) provider: ExternalProvider,
    @Body() dto: ConnectProviderDto,
  ) {
    return this.migrations.connect(req.user.id, provider, dto.accessToken);
  }

  @Delete(':provider/connect')
  disconnect(
    @Req() req: AuthenticatedRequest,
    @Param('provider', ParseExternalProviderPipe) provider: ExternalProvider,
  ) {
    return this.migrations.disconnect(req.user.id, provider);
  }

  @Get(':provider/projects')
  listProjects(
    @Req() req: AuthenticatedRequest,
    @Param('provider', ParseExternalProviderPipe) provider: ExternalProvider,
  ) {
    return this.migrations.listProjects(req.user.id, provider);
  }

  @Get(':provider/projects/:externalId')
  getProjectDetail(
    @Req() req: AuthenticatedRequest,
    @Param('provider', ParseExternalProviderPipe) provider: ExternalProvider,
    @Param('externalId') externalId: string,
  ) {
    return this.migrations.getProjectDetail(req.user.id, provider, externalId);
  }
}
