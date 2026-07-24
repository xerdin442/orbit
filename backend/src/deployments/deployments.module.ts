import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DeploymentsService } from './deployments.service';
import { DeploymentsController } from './deployments.controller';
import { DeploymentProcessor } from './deployment.processor';
import { ResourcesModule } from '@src/resources/resources.module';

@Module({
  imports: [ResourcesModule, BullModule.registerQueue({ name: 'deployments' })],
  controllers: [DeploymentsController],
  providers: [DeploymentsService, DeploymentProcessor],
})
export class DeploymentsModule {}
