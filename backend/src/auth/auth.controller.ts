import { Controller, Get, Query, Redirect } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('github')
  @Redirect()
  githubLogin() {
    return { url: this.auth.getGitHubOAuthUrl() };
  }

  @Get('github/callback')
  async githubCallback(@Query('code') code: string) {
    return this.auth.handleGitHubCallback(code);
  }
}
