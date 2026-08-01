import { Injectable } from '@nestjs/common';
import type {
  Installation,
  InstallationQuery,
  InstallationStore,
} from '@slack/bolt';
import { DbService } from '@src/db/db.service';
import { EncryptionService } from '@src/infrastructure/encryption.service';
import type { Prisma } from '@generated/client';
import { SlackInstallationData } from '@src/common/types';

@Injectable()
export class SlackInstallationStore implements InstallationStore {
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

    await this.storeInstallationData({
      userId,
      teamId: installation.team!.id,
      teamName: installation.team?.name ?? null,
      enterpriseId: installation.enterprise?.id ?? null,
      botToken,
      botUserId: installation.bot?.userId ?? null,
      botId: installation.bot?.id ?? null,
      appId: installation.appId ?? null,
      scopes: installation.bot?.scopes ?? [],
      installerSlackUserId: installation.user.id,
      isEnterpriseInstall: installation.isEnterpriseInstall ?? false,
      raw: installation as unknown as Prisma.InputJsonValue,
    });
  }

  async storeInstallationData(data: SlackInstallationData): Promise<void> {
    const encryptedToken = this.encryption.encrypt(data.botToken);

    const prismaData = {
      userId: data.userId,
      teamName: data.teamName,
      enterpriseId: data.enterpriseId,
      botUserId: data.botUserId,
      botId: data.botId,
      appId: data.appId,
      scopes: data.scopes,
      botToken: encryptedToken,
      installerSlackUserId: data.installerSlackUserId,
      raw: data.raw ?? {},
      isActive: true,
    };

    await this.db.slackInstallation.upsert({
      where: { teamId: data.teamId },
      create: {
        ...prismaData,
        teamId: data.teamId,
      },
      update: prismaData,
    });
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

    const installation: Installation = {
      team: { id: record.teamId, name: record.teamName ?? undefined },
      enterprise: record.enterpriseId ? { id: record.enterpriseId } : undefined,
      user: {
        token: undefined,
        scopes: undefined,
        id: record.installerSlackUserId,
      },
      bot: {
        token: this.encryption.decrypt(record.botToken),
        scopes: record.scopes,
        id: record.botId ?? '',
        userId: record.botUserId ?? '',
      },
      appId: record.appId ?? undefined,
      tokenType: 'bot',
      isEnterpriseInstall: record.isEnterpriseInstall ?? false,
      authVersion: 'v2',
    };

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
  }

  async getRecord(teamId: string) {
    return this.db.slackInstallation.findFirst({
      where: { teamId, isActive: true },
    });
  }
}
