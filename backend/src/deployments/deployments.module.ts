import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
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
export class DeploymentsModule {}
