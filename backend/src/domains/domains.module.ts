import { Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { DomainsService } from './domains.service';
import { DomainsController } from './domains.controller';
import { DomainVerificationProcessor } from './domain-verification.processor';

@Module({
  imports: [BullModule.registerQueue({ name: 'domains' })],
  controllers: [DomainsController],
  providers: [DomainsService, DomainVerificationProcessor],
})
export class DomainsModule implements OnModuleInit {
  constructor(@InjectQueue('domains') private readonly domainQueue: Queue) {}

  async onModuleInit() {
    await this.domainQueue.add(
      'verify',
      {},
      {
        repeat: { every: 60_000 },
        removeOnComplete: true,
      },
    );
  }
}
