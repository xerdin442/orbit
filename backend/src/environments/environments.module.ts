import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { EnvironmentsService } from './environments.service';
import { EnvironmentsController } from './environments.controller';

@Module({
  imports: [BullModule.registerQueue({ name: 'deployments' })],
  controllers: [EnvironmentsController],
  providers: [EnvironmentsService],
})
export class EnvironmentsModule {}
