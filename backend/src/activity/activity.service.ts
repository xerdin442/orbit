import { Injectable } from '@nestjs/common';
import { DbService } from '@src/db/db.service';
import { ActivityType } from '@generated/client';
import type { Prisma } from '@generated/client';
import { ActivityLogFilter } from '@src/common/types';

@Injectable()
export class ActivityService {
  constructor(private readonly db: DbService) {}

  async log(
    type: ActivityType,
    actorId: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.db.activity.create({
      data: {
        type,
        actorId,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }

  async findLogs(options: ActivityLogFilter) {
    const where: Prisma.ActivityWhereInput = {};

    if (options.actorId) {
      where.actorId = options.actorId;
    }

    if (options.type) {
      where.type = this.resolveTypeFilter(options.type);
    }

    if (options.projectId) {
      where.metadata = { path: ['projectId'], equals: options.projectId };
    }

    if (options.environmentId) {
      where.metadata = {
        path: ['environmentId'],
        equals: options.environmentId,
      };
    }

    if (options.domainId) {
      where.metadata = { path: ['domainId'], equals: options.domainId };
    }

    if (options.deploymentId) {
      where.metadata = {
        path: ['deploymentId'],
        equals: options.deploymentId,
      };
    }

    if (options.resourceId) {
      where.metadata = { path: ['resourceId'], equals: options.resourceId };
    }

    return this.db.activity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  private resolveTypeFilter(pattern: string): Prisma.EnumActivityTypeFilter {
    if (pattern.endsWith('_*')) {
      return {
        startsWith: pattern.slice(0, -1),
      } as Prisma.EnumActivityTypeFilter;
    }

    return { equals: pattern as ActivityType };
  }
}
