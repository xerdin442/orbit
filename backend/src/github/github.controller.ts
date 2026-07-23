import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Req,
  Redirect,
  ParseIntPipe,
} from '@nestjs/common';
import { GitHubService } from './github.service';
import { Secrets } from '@src/common/secrets';
import { JwtAuthGuard } from '@src/auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '@src/common/types';

@Controller('github')
@UseGuards(JwtAuthGuard)
export class GitHubController {
  constructor(private readonly github: GitHubService) {}

  @Get('install')
  install() {
    return { url: this.github.getInstallUrl() };
  }

  @Get('install/callback')
  @Redirect()
  async installCallback(
    @Req() req: AuthenticatedRequest,
    @Query('installation_id', ParseIntPipe) installationId: number,
  ) {
    await this.github.handleInstallCallback(installationId, req.user.id);
    return { url: Secrets.FRONTEND_URL };
  }

  @Get('installations')
  listInstallations(@Req() req: AuthenticatedRequest) {
    return this.github.listInstallations(req.user.id);
  }

  @Get(':installationId/repositories')
  listRepositories(
    @Param('installationId', ParseIntPipe) installationId: number,
  ) {
    return this.github.listRepositories(installationId);
  }

  @Get(':installationId/update-access')
  updateAccess(@Param('installationId', ParseIntPipe) installationId: number) {
    return { url: this.github.getUpdateAccessUrl(installationId) };
  }

  @Get('branches')
  listBranches(
    @Query('installationId', ParseIntPipe) installationId: number,
    @Query('repo') repoFullName: string,
  ) {
    const url = `https://github.com/${repoFullName}`;
    return this.github.listBranches(installationId, url);
  }
}
