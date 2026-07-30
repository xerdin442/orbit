import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ResourcesService } from './resources.service';
import { ResourcesController } from './resources.controller';
import { ResourceProcessor } from './resource.processor';

@Module({
  imports: [BullModule.registerQueue({ name: 'resources' })],
  controllers: [ResourcesController],
  providers: [ResourcesService, ResourceProcessor],
  exports: [ResourcesService],
})
export class ResourcesModule {}
