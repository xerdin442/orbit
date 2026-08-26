import { Injectable, NotFoundException } from '@nestjs/common';
import { Subject } from 'rxjs';
import { Prisma, type RequestLog } from '@generated/client';
import { DbService } from '@src/db/db.service';
import type {
  PaginatedResult,
  ParsedAccessLogLine,
  StatusClass,
} from '@src/common/types';
import type { FilterRequestLogsDto } from './dto/request-log.dto';

function statusClassRange(statusClass: StatusClass): {
  gte: number;
  lt: number;
} {
  const base = Number(statusClass[0]) * 100;
  return { gte: base, lt: base + 100 };
}

@Injectable()
export class RequestLogsService {
  private readonly streams = new Map<string, Subject<RequestLog>>();

  constructor(private readonly db: DbService) {}

  async append(
    environmentId: string,
    entry: ParsedAccessLogLine,
  ): Promise<RequestLog> {
    const created = await this.db.requestLog.create({
      data: {
        environmentId,
        ...entry,
        method: entry.method.toUpperCase(),
      },
    });

    const stream = this.streams.get(environmentId);
    if (stream) stream.next(created);

    return created;
  }

  async subscribeForUser(
    environmentId: string,
    userId: string,
  ): Promise<Subject<RequestLog>> {
    await this.verifyEnvironmentOwnership(environmentId, userId);
    return this.subscribe(environmentId);
  }

  async getRecent(environmentId: string, limit = 20): Promise<RequestLog[]> {
    const rows = await this.db.requestLog.findMany({
      where: { environmentId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return rows.reverse();
  }

  async findByEnvironment(
    environmentId: string,
    userId: string,
    filters: FilterRequestLogsDto,
  ): Promise<PaginatedResult<RequestLog>> {
    await this.verifyEnvironmentOwnership(environmentId, userId);

    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;

    const where: Prisma.RequestLogWhereInput = { environmentId };

    if (filters.method) {
      where.method = filters.method.toUpperCase();
    }

    if (filters.statusCode) {
      where.statusCode = filters.statusCode;
    } else if (filters.statusClass) {
      where.statusCode = statusClassRange(filters.statusClass);
    }

    const [data, total] = await Promise.all([
      this.db.requestLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.db.requestLog.count({ where }),
    ]);

    return {
      data,
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

  private subscribe(environmentId: string): Subject<RequestLog> {
    const existing = this.streams.get(environmentId);
    if (existing) return existing;

    const stream = new Subject<RequestLog>();
    this.streams.set(environmentId, stream);
    return stream;
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
}
