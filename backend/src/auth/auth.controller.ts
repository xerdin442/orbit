import { Controller, Get, Query, Redirect } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Secrets } from '@src/common/secrets';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('github')
  @Redirect()
  githubLogin() {
    return { url: this.auth.getGitHubOAuthUrl() };
  }

  @Get('github/callback')
  @Redirect()
  async githubCallback(@Query('code') code: string) {
    const accessToken = await this.auth.handleGitHubCallback(code);
    return {
      url: `${Secrets.FRONTEND_URL}?source=github_redirect&token=${accessToken}`,
    };
  }
}
