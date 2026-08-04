import { Injectable } from '@nestjs/common';
import { DbService } from '@src/db/db.service';
import { Activity, ActivityType } from '@generated/client';
import type { Prisma } from '@generated/client';
import { FilterActivityLogsDto } from './dto/activity-log.dto';
import { PaginatedResult } from '@src/common/types';

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

  async findLogs(
    actorId: string,
    options: FilterActivityLogsDto,
  ): Promise<PaginatedResult<Activity>> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;

    const conditions: Prisma.ActivityWhereInput[] = [{ actorId }];

    if (options.type) {
      conditions.push({ type: this.resolveTypeFilter(options.type) });
    }

    if (options.endDate) {
      options.endDate.setHours(23, 59, 59, 999);
      conditions.push({ createdAt: { lte: options.endDate } });
    }

    if (options.startDate) {
      conditions.push({ createdAt: { gte: options.startDate } });
    }

    const entityFilters: Array<{ path: string[]; id: string }> = [];
    if (options.projectId) {
      entityFilters.push({ path: ['projectId'], id: options.projectId });
    }
    if (options.environmentId) {
      entityFilters.push({
        path: ['environmentId'],
        id: options.environmentId,
      });
    }
    if (options.domainId) {
      entityFilters.push({ path: ['domainId'], id: options.domainId });
    }
    if (options.deploymentId) {
      entityFilters.push({
        path: ['deploymentId'],
        id: options.deploymentId,
      });
    }
    if (options.resourceId) {
      entityFilters.push({ path: ['resourceId'], id: options.resourceId });
    }

    for (const filter of entityFilters) {
      conditions.push({
        metadata: { path: filter.path, equals: filter.id },
      });
    }

    const where: Prisma.ActivityWhereInput = { AND: conditions };

    const [logs, total] = await Promise.all([
      this.db.activity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.db.activity.count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    };
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
