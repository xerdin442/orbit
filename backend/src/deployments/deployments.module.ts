import { Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { DeploymentsService } from './deployments.service';
import { DeploymentsController } from './deployments.controller';
import { DeploymentProcessor } from './deployment.processor';
import { ResourcesModule } from '@src/resources/resources.module';
import { GitHubModule } from '@src/github/github.module';

@Module({
  imports: [
    ResourcesModule,
    GitHubModule,
    BullModule.registerQueue({ name: 'deployments' }),
  ],
  controllers: [DeploymentsController],
  providers: [DeploymentsService, DeploymentProcessor],
  exports: [DeploymentsService],
})
export class DeploymentsModule implements OnModuleInit {
  constructor(
    @InjectQueue('deployments') private readonly deployQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.deployQueue.add(
      'prune-images',
      {},
      {
        repeat: { every: 24 * 60 * 60 * 1000 },
        removeOnComplete: true,
      },
    );
  }
}
