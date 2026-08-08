import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CleanupService } from './cleanup.service';
import { CleanupProcessor } from './cleanup.processor';
import { InfrastructureModule } from '@src/infrastructure/infrastructure.module';

@Global()
@Module({
  imports: [
    BullModule.registerQueue({ name: 'cleanup' }),
    InfrastructureModule,
  ],
  providers: [CleanupService, CleanupProcessor],
  exports: [CleanupService],
})
export class CleanupModule {}
