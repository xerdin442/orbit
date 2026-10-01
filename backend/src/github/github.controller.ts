import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Req,
  Redirect,
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
    @Query('installation_id') installationId: string,
  ) {
    await this.github.handleInstallCallback(
      Number(installationId),
      req.user.id,
    );

    return { url: Secrets.FRONTEND_URL };
  }

  @Get('installations')
  listInstallations(@Req() req: AuthenticatedRequest) {
    return this.github.listInstallations(req.user.id);
  }

  @Get(':installationId/repositories')
  listRepositories(@Param('installationId') installationId: string) {
    return this.github.listRepositories(Number(installationId));
  }

  @Get(':installationId/update-access')
  updateAccess(@Param('installationId') installationId: string) {
    return { url: this.github.getUpdateAccessUrl(Number(installationId)) };
  }

  @Get('branches')
  listBranches(
    @Query('installationId') installationId: string,
    @Query('repo') repoFullName: string,
  ) {
    const url = `https://github.com/${repoFullName}`;
    return this.github.listBranches(Number(installationId), url);
  }
}
