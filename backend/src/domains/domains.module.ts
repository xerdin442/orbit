import { Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
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
      {},
      {
        repeat: { every: 60_000 },
        removeOnComplete: true,
      },
    );
  }
}
