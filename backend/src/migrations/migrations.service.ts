import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '@src/db/db.service';
import { EncryptionService } from '@src/infrastructure/encryption.service';
import { ActivityService } from '@src/activity/activity.service';
import { ActivityType, ExternalProvider } from '@generated/client';
import { RailwayProvider } from './providers/railway.provider';
import { VercelProvider } from './providers/vercel.provider';
import type { MigrationProvider } from './providers/migration-provider.interface';

@Injectable()
export class MigrationsService {
  constructor(
    private readonly db: DbService,
    private readonly encryption: EncryptionService,
    private readonly activity: ActivityService,
    private readonly railway: RailwayProvider,
    private readonly vercel: VercelProvider,
  ) {}

  async connect(
    userId: string,
    provider: ExternalProvider,
    accessToken: string,
  ) {
    const valid = await this.getProvider(provider).validateToken(accessToken);
    if (!valid) {
      throw new BadRequestException(`Invalid ${provider} access token`);
    }

    const encryptedToken = this.encryption.encrypt(accessToken);

    await this.db.externalConnection.upsert({
      where: { userId_provider: { userId, provider } },
      create: { userId, provider, accessToken: encryptedToken },
      update: { accessToken: encryptedToken },
    });

    await this.activity.log(ActivityType.external_connection_added, userId, {
      provider,
    });
  }

  async disconnect(userId: string, provider: ExternalProvider) {
    const connection = await this.db.externalConnection.findUnique({
      where: { userId_provider: { userId, provider } },
    });

    if (!connection) return;

    await this.db.externalConnection.delete({
      where: { id: connection.id },
    });

    await this.activity.log(ActivityType.external_connection_removed, userId, {
      provider,
    });
  }

  async listProjects(userId: string, provider: ExternalProvider) {
    const token = await this.getDecryptedToken(userId, provider);
    return this.getProvider(provider).listProjects(token);
  }

  async getProjectDetail(
    userId: string,
    provider: ExternalProvider,
    externalId: string,
  ) {
    const token = await this.getDecryptedToken(userId, provider);
    return this.getProvider(provider).getProjectDetail(token, externalId);
  }

  private getProvider(provider: ExternalProvider): MigrationProvider {
    switch (provider) {
      case ExternalProvider.railway:
        return this.railway;
      case ExternalProvider.vercel:
        return this.vercel;
    }
  }

  private async getDecryptedToken(
    userId: string,
    provider: ExternalProvider,
  ): Promise<string> {
    const connection = await this.db.externalConnection.findUnique({
      where: { userId_provider: { userId, provider } },
    });

    if (!connection) {
      throw new NotFoundException(`No ${provider} connection found`);
    }

    return this.encryption.decrypt(connection.accessToken);
  }
}
