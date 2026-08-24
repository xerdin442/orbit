import {
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { GitHubService } from './github.service';
import { Logger } from '@src/common/logger';
import { GitHubWebhookPayload } from '@src/common/types';

@Controller('github')
export class GitHubWebhookController {
  private readonly logger = Logger(GitHubWebhookController.name);

  constructor(private readonly github: GitHubService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature: string,
    @Headers('x-github-event') event: string,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) {
      return { ok: false };
    }

    if (!this.github.verifySignature(rawBody, signature)) {
      this.logger.warn('Invalid webhook signature');
      return { ok: false };
    }

    const payload = JSON.parse(rawBody.toString()) as GitHubWebhookPayload;

    if (event === 'push' && payload.ref && payload.repository) {
      await this.github.handlePushEvent(
        payload.ref,
        payload.repository.full_name,
      );
    }

    return { ok: true };
  }
}
