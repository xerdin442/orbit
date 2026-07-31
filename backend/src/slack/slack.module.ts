import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SlackInstallationStore } from './slack-installation.store';
import { SlackBoltService } from './slack-bolt.service';
import { SlackInstallController } from './slack-install.controller';
import { SlackApiService } from './slack-api.service';
import { SlackApiProcessor } from './slack-api.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'slack-api' }),
    BullModule.registerQueue({ name: 'deployments' }),
  ],
  controllers: [SlackInstallController],
  providers: [
    SlackInstallationStore,
    SlackBoltService,
    SlackApiService,
    SlackApiProcessor,
  ],
  exports: [SlackBoltService, SlackInstallationStore, SlackApiService],
})
export class SlackModule {}
