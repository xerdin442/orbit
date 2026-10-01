import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DeploymentsService } from './deployments.service';
import { DeploymentsController } from './deployments.controller';
import { DeploymentProcessor } from './deployment.processor';
import { LogService } from './log.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'deployments' })],
  controllers: [DeploymentsController],
  providers: [DeploymentsService, DeploymentProcessor, LogService],
})
export class DeploymentsModule {}
