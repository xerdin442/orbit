import {
  Controller,
  Get,
  Query,
  Redirect,
  Req,
  UseGuards,
} from '@nestjs/common';
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
  @Redirect()
  async githubCallback(
    @Query('code') code: string,
    @Query('state') state?: string,
  ) {
    const redirectUrl = await this.auth.handleGitHubCallback(code, state);
    return { url: redirectUrl };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: AuthenticatedRequest) {
    return this.auth.getAuthenticatedUser(req.user.id);
  }
}
