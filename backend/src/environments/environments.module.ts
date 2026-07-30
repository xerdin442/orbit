import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EnvironmentsService } from './environments.service';
import { EnvironmentsController } from './environments.controller';
import { CleanupModule } from '@src/cleanup/cleanup.module';

@Module({
  imports: [BullModule.registerQueue({ name: 'deployments' }), CleanupModule],
  controllers: [EnvironmentsController],
  providers: [EnvironmentsService],
})
export class EnvironmentsModule {}
