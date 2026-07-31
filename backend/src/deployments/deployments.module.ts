import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DeploymentsService } from './deployments.service';
import { DeploymentsController } from './deployments.controller';
import { DeploymentProcessor } from './deployment.processor';
import { ResourcesModule } from '@src/resources/resources.module';
import { SlackModule } from '@src/slack/slack.module';

@Module({
  imports: [
    ResourcesModule,
    BullModule.registerQueue({ name: 'deployments' }),
    SlackModule,
  ],
  controllers: [DeploymentsController],
  providers: [DeploymentsService, DeploymentProcessor],
})
export class DeploymentsModule {}
