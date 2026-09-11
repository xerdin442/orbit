import { Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { DeploymentsModule } from '@src/deployments/deployments.module';
import { SlackInstallationStore } from './slack-installation.store';
import { SlackBoltService } from './slack-bolt.service';
import { SlackInstallController } from './slack-install.controller';
import { SlackApiService } from './slack-api.service';
import { SlackApiProcessor } from './slack-api.processor';
import { SlackDeploymentEventsListener } from './events/deployment-events.listener';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'slack-api' }),
    BullModule.registerQueue({ name: 'deployments' }),
    DeploymentsModule,
  ],
  controllers: [SlackInstallController],
  providers: [
    SlackInstallationStore,
    SlackBoltService,
    SlackApiService,
    SlackApiProcessor,
    SlackDeploymentEventsListener,
  ],
  exports: [SlackBoltService, SlackInstallationStore, SlackApiService],
})
export class SlackModule implements OnModuleInit {
  constructor(@InjectQueue('slack-api') private readonly slackQueue: Queue) {}

  async onModuleInit() {
    await this.slackQueue.add(
      'cleanup-inactive-installations',
      {},
      {
        repeat: { every: 24 * 60 * 60 * 1000 },
        removeOnComplete: true,
      },
    );
  }
}
