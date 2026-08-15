import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { GitHubService } from './github.service';
import { GitHubController } from './github.controller';
import { GitHubWebhookController } from './github.webhook.controller';

@Module({
  imports: [BullModule.registerQueue({ name: 'deployments' })],
  controllers: [GitHubController, GitHubWebhookController],
  providers: [GitHubService],
  exports: [GitHubService],
})
export class GitHubModule {}
