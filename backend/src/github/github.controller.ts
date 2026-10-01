import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
  ParseIntPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { GitHubService } from './github.service';
import { JwtAuthGuard } from '@src/common/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '@src/common/types';

@Controller('github')
export class GitHubController {
  constructor(private readonly github: GitHubService) {}

  @Get('install')
  @UseGuards(JwtAuthGuard)
  async install(@Req() req: AuthenticatedRequest) {
    const url = await this.github.getInstallUrl(req.user.id);
    return { url };
  }

  @Get('install/callback')
  async installCallback(
    @Query('installation_id', ParseIntPipe) installationId: number,
    @Res() res: Response,
    @Query('state') state?: string,
  ) {
    const redirectUrl = await this.github.handleInstallCallback(
      installationId,
      state,
    );
    res.redirect(redirectUrl);
  }

  @Get('installations')
  @UseGuards(JwtAuthGuard)
  listInstallations(@Req() req: AuthenticatedRequest) {
    return this.github.listInstallations(req.user.id);
  }

  @Delete('installations/:installationId')
  @UseGuards(JwtAuthGuard)
  removeInstallation(
    @Req() req: AuthenticatedRequest,
    @Param('installationId', ParseIntPipe) installationId: number,
  ) {
    return this.github.deleteInstallation(installationId, req.user.id);
  }

  @Get('installations/:installationId/repositories')
  @UseGuards(JwtAuthGuard)
  listRepositories(
    @Req() req: AuthenticatedRequest,
    @Param('installationId', ParseIntPipe) installationId: number,
  ) {
    return this.github.listRepositories(installationId, req.user.id);
  }

  @Get('installations/:installationId/update-access')
  @UseGuards(JwtAuthGuard)
  async updateAccess(
    @Req() req: AuthenticatedRequest,
    @Param('installationId', ParseIntPipe) installationId: number,
  ) {
    const url = await this.github.getUpdateAccessUrl(
      installationId,
      req.user.id,
    );
    return { url };
  }

  @Get('installations/:installationId/branches')
  @UseGuards(JwtAuthGuard)
  listBranches(
    @Req() req: AuthenticatedRequest,
    @Param('installationId', ParseIntPipe) installationId: number,
    @Query('repo') repoFullName: string,
  ) {
    const url = `https://github.com/${repoFullName}`;
    return this.github.listBranches(installationId, url, req.user.id);
  }
}
