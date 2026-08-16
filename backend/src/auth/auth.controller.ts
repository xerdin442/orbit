import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthenticatedRequest } from '@src/common/types';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('github')
  async githubLogin(@Query('redirect_uri') redirectUri?: string) {
    const url = await this.auth.getGitHubOAuthUrl(redirectUri);
    return { url };
  }

  @Get('github/callback')
  async githubCallback(
    @Query('code') code: string,
    @Res() res: Response,
    @Query('state') state?: string,
  ) {
    const redirectUrl = await this.auth.handleGitHubCallback(code, state);
    res.redirect(redirectUrl);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: AuthenticatedRequest) {
    return this.auth.getAuthenticatedUser(req.user.id);
  }
}
