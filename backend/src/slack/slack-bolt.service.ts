import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { App, ExpressReceiver } from '@slack/bolt';
import { Secrets } from '@src/common/secrets';
import { SlackInstallationStore } from './slack-installation.store';
import { SlackApiService } from './slack-api.service';
import { ActivityService } from '@src/activity/activity.service';
import { ActivityType } from '@generated/client';

@Injectable()
export class SlackBoltService implements OnModuleInit {
  private readonly logger = new Logger(SlackBoltService.name);
  public readonly receiver: ExpressReceiver;
  public readonly app: App;

  constructor(
    private readonly installationStore: SlackInstallationStore,
    private readonly slackApi: SlackApiService,
    private readonly activity: ActivityService,
  ) {
    this.receiver = new ExpressReceiver({
      signingSecret: Secrets.SLACK_SIGNING_SECRET,
      installationStore: this.installationStore,
      processBeforeResponse: true,
    });

    this.app = new App({
      receiver: this.receiver,
    });

    this.registerListeners();
  }

  async onModuleInit(): Promise<void> {
    await this.app.init();
  }

  private registerListeners(): void {
    this.registerLifecycleEvents();
    // this.registerCommands();
  }

  private registerLifecycleEvents(): void {
    this.app.event('app_uninstalled', async ({ context }) => {
      const { teamId, enterpriseId, isEnterpriseInstall } = context;
      await this.installationStore.deleteInstallation({
        teamId,
        enterpriseId,
        isEnterpriseInstall,
      });

      this.logger.log(`App uninstalled from team ${teamId}`);

      try {
        await this.activity.log(
          ActivityType.slack_installation_removed,
          'system',
          { teamId, enterpriseId },
        );
      } catch {
        // activity logging does not block event processing
      }
    });

    this.app.event('tokens_revoked', async ({ context }) => {
      const { teamId, enterpriseId, isEnterpriseInstall } = context;
      await this.installationStore.deleteInstallation({
        teamId,
        enterpriseId,
        isEnterpriseInstall,
      });

      this.logger.warn(`Tokens revoked for team ${teamId}`);
    });
  }
}
