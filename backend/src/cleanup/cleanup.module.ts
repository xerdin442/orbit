import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CleanupService } from './cleanup.service';
import { CleanupProcessor } from './cleanup.processor';

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: 'cleanup' })],
  providers: [CleanupService, CleanupProcessor],
  exports: [CleanupService],
})
export class CleanupModule {}
