import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { DbService } from '@src/db/db.service';
import { ActivityService } from '@src/activity/activity.service';
import { Secrets } from '@src/common/secrets';
import { ActivityType, DomainType, DomainStatus } from '@generated/client';
import type { DnsInstructions } from '@src/common/types';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';

@Injectable()
export class DomainsService {
  constructor(
    private readonly db: DbService,
    private readonly activity: ActivityService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async addCustomDomain(
    environmentId: string,
    hostname: string,
    userId: string,
  ) {
    await this.verifyEnvironmentOwnership(environmentId, userId);

    const existing = await this.db.domain.findFirst({
      where: { hostname },
    });

    if (existing) {
      throw new ConflictException('This domain is already registered');
    }

    const domain = await this.db.domain.create({
      data: {
        hostname,
        type: DomainType.custom,
        status: DomainStatus.pending,
        environmentId,
      },
    });

    await this.invalidateCache(environmentId);

    await this.activity.log(ActivityType.domain_added, userId, {
      domainId: domain.id,
      hostname,
      environmentId,
    });

    return this.getDnsInstructions(hostname);
  }

  async findByEnvironment(environmentId: string, userId: string) {
    await this.verifyEnvironmentOwnership(environmentId, userId);

    return this.db.domain.findMany({
      where: { environmentId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string, userId: string) {
    const domain = await this.db.domain.findFirst({
      where: { id, environment: { project: { ownerId: userId } } },
    });

    if (!domain) {
      throw new NotFoundException('Domain not found');
    }

    return domain;
  }

  async getInstructions(id: string, userId: string) {
    const domain = await this.findOne(id, userId);

    if (
      domain.status === DomainStatus.active ||
      domain.status === DomainStatus.failed
    ) {
      throw new ConflictException(
        'DNS instructions are only available for domains pending verification',
      );
    }

    return this.getDnsInstructions(domain.hostname);
  }

  async deleteDomain(id: string, userId: string) {
    const domain = await this.db.domain.findFirst({
      where: { id, environment: { project: { ownerId: userId } } },
    });

    if (!domain) {
      throw new NotFoundException('Domain not found');
    }

    if (domain.type === DomainType.managed) {
      throw new UnauthorizedException('Managed hostnames cannot be deleted');
    }

    await this.db.domain.delete({ where: { id } });

    await this.invalidateCache(domain.environmentId);

    await this.activity.log(ActivityType.domain_removed, userId, {
      domainId: id,
      hostname: domain.hostname,
      environmentId: domain.environmentId,
    });
  }

  private getDnsInstructions(hostname: string): DnsInstructions {
    const parts = hostname.split('.');
    const isApex = parts.length <= 2;

    if (isApex) {
      return {
        recordType: 'A',
        host: '@',
        value: Secrets.INGRESS_IP,
      };
    }

    return {
      recordType: 'CNAME',
      host: parts[0],
      value: Secrets.INGRESS_HOST,
    };
  }

  private async verifyEnvironmentOwnership(
    environmentId: string,
    userId: string,
  ) {
    const env = await this.db.environment.findFirst({
      where: { id: environmentId, project: { ownerId: userId } },
    });

    if (!env) {
      throw new NotFoundException('Environment not found');
    }
  }

  private async invalidateCache(envId: string) {
    await this.cache.del(`/api/environments/${envId}/domains`);
  }
}
