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

  async findAll(options?: ActivityLogFilter) {
    const where: Prisma.ActivityWhereInput = {};

    if (options?.actorId) {
      where.actorId = options.actorId;
    }

    if (options?.type) {
      where.type = options.type;
    }

    if (options?.projectId) {
      where.metadata = { path: ['projectId'], equals: options.projectId };
    }

    if (options?.environmentId) {
      where.metadata = {
        path: ['environmentId'],
        equals: options.environmentId,
      };
    }

    if (options?.domainId) {
      where.metadata = { path: ['domainId'], equals: options.domainId };
    }

    if (options?.deploymentId) {
      where.metadata = {
        path: ['deploymentId'],
        equals: options.deploymentId,
      };
    }

    if (options?.resourceId) {
      where.metadata = { path: ['resourceId'], equals: options.resourceId };
    }

    return this.db.activity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByType(type: ActivityType) {
    return this.db.activity.findMany({
      where: { type },
      orderBy: { createdAt: 'desc' },
    });
  }
}
