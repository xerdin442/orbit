import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EnvironmentsService } from './environments.service';
import { EnvironmentsController } from './environments.controller';
import { DeploymentsModule } from '@src/deployments/deployments.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'deployments' }),
    DeploymentsModule,
  ],
  controllers: [EnvironmentsController],
  providers: [EnvironmentsService],
})
export class EnvironmentsModule {}
