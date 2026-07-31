import { Injectable, Logger } from '@nestjs/common';
import type {
  Installation,
  InstallationQuery,
  InstallationStore,
} from '@slack/bolt';
import { DbService } from '@src/db/db.service';
import { EncryptionService } from '@src/infrastructure/encryption.service';
import type { Prisma } from '@generated/client';

@Injectable()
export class SlackInstallationStore implements InstallationStore {
  private readonly logger = new Logger(SlackInstallationStore.name);

  constructor(
    private readonly db: DbService,
    private readonly encryption: EncryptionService,
  ) {}

  async storeInstallation(installation: Installation): Promise<void> {
    const userId = installation.metadata;
    if (!userId) {
      throw new Error('userId is required in installation.metadata');
    }

    const botToken = installation.bot?.token;
    if (!botToken) {
      throw new Error('bot token is required');
    }

    const encryptedToken = this.encryption.encrypt(botToken);

    const data = {
      userId,
      teamName: installation.team?.name ?? null,
      enterpriseId: installation.enterprise?.id ?? null,
      botUserId: installation.bot?.userId ?? null,
      botId: installation.bot?.id ?? null,
      appId: installation.appId ?? null,
      scopes: installation.bot?.scopes ?? [],
      botToken: encryptedToken,
      installerSlackUserId: installation.user.id,
      raw: installation as unknown as Prisma.InputJsonValue,
      isActive: true,
    };

    await this.db.slackInstallation.upsert({
      where: { teamId: installation.team!.id },
      create: {
        ...data,
        teamId: installation.team!.id,
      },
      update: data,
    });

    this.logger.log(`Stored installation for team ${installation.team!.id}`);
  }

  async fetchInstallation(
    query: InstallationQuery<boolean>,
  ): Promise<Installation> {
    const { teamId, enterpriseId, isEnterpriseInstall } = query;

    const record = await this.db.slackInstallation.findFirst({
      where: {
        ...(isEnterpriseInstall ? { enterpriseId } : { teamId }),
        isActive: true,
      },
    });

    if (!record) {
      const lookupKey = isEnterpriseInstall
        ? `enterprise ${enterpriseId}`
        : `team ${teamId}`;
      throw new Error(`No active installation found for ${lookupKey}`);
    }

    const installation = record.raw as unknown as Installation;
    if (installation.bot?.token) {
      installation.bot.token = this.encryption.decrypt(record.botToken);
    }

    return installation;
  }

  async deleteInstallation(query: InstallationQuery<boolean>): Promise<void> {
    const { teamId, enterpriseId, isEnterpriseInstall } = query;

    const record = await this.db.slackInstallation.findFirst({
      where: {
        ...(isEnterpriseInstall ? { enterpriseId } : { teamId }),
      },
    });

    if (!record) return;

    await this.db.slackInstallation.update({
      where: { id: record.id },
      data: { isActive: false },
    });

    this.logger.log(
      `Soft-deleted installation for ${isEnterpriseInstall ? `enterprise ${enterpriseId}` : `team ${teamId}`}`,
    );
  }

  async getRecord(teamId: string) {
    return this.db.slackInstallation.findFirst({
      where: { teamId, isActive: true },
    });
  }
}
