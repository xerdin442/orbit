import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EnvironmentsService } from './environments.service';
import { EnvironmentsController } from './environments.controller';
import { CleanupModule } from '@src/cleanup/cleanup.module';
import { DeploymentsModule } from '@src/deployments/deployments.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'deployments' }),
    DeploymentsModule,
    CleanupModule,
  ],
  controllers: [EnvironmentsController],
  providers: [EnvironmentsService],
})
export class EnvironmentsModule {}
