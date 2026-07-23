import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { GitHubService } from './github.service';
import { GitHubController } from './github.controller';
import { GitHubWebhookController } from './github.webhook.controller';

@Module({
  imports: [BullModule.registerQueue({ name: 'deployments' })],
  controllers: [GitHubController, GitHubWebhookController],
  providers: [GitHubService],
})
export class GitHubModule {}
