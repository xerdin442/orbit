import { Injectable, NotFoundException } from '@nestjs/common';
import { Subject } from 'rxjs';
import { Prisma } from '@generated/client';
import { DbService } from '@src/db/db.service';
import type {
  PaginatedResult,
  ParsedAccessLogLine,
  RequestLogView,
  StatusClass,
} from '@src/common/types';
import type { FilterRequestLogsDto } from './dto/request-log.dto';

const PUBLIC_FIELDS = { omit: { clientIp: true } } as const;

function statusClassRange(statusClass: StatusClass): {
  gte: number;
  lt: number;
} {
  const base = Number(statusClass[0]) * 100;
  return { gte: base, lt: base + 100 };
}

@Injectable()
export class RequestLogsService {
  private readonly streams = new Map<string, Subject<RequestLogView>>();

  constructor(private readonly db: DbService) {}

  async append(
    environmentId: string,
    entry: ParsedAccessLogLine,
  ): Promise<RequestLogView> {
    const created = await this.db.requestLog.create({
      data: {
        environmentId,
        ...entry,
        method: entry.method.toUpperCase(),
      },
      ...PUBLIC_FIELDS,
    });

    const stream = this.streams.get(environmentId);
    if (stream) stream.next(created);

    return created;
  }

  async deleteRecentByClientIp(
    clientIp: string,
    windowMs: number,
  ): Promise<number> {
    const { count } = await this.db.requestLog.deleteMany({
      where: {
        clientIp,
        timestamp: { gte: new Date(Date.now() - windowMs) },
      },
    });

    return count;
  }

  async subscribeForUser(
    environmentId: string,
    userId: string,
  ): Promise<Subject<RequestLogView>> {
    await this.verifyEnvironmentOwnership(environmentId, userId);
    return this.subscribe(environmentId);
  }

  async getRecent(
    environmentId: string,
    limit = 20,
  ): Promise<RequestLogView[]> {
    const rows = await this.db.requestLog.findMany({
      where: { environmentId },
      orderBy: { timestamp: 'desc' },
      take: limit,
      ...PUBLIC_FIELDS,
    });

    return rows.reverse();
  }

  async findByEnvironment(
    environmentId: string,
    userId: string,
    filters: FilterRequestLogsDto,
  ): Promise<PaginatedResult<RequestLogView>> {
    await this.verifyEnvironmentOwnership(environmentId, userId);

    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;

    const where: Prisma.RequestLogWhereInput = { environmentId };

    if (filters.method) {
      where.method = filters.method.toUpperCase();
    }

    if (filters.path) {
      where.path = { contains: filters.path };
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
        ...PUBLIC_FIELDS,
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

  private subscribe(environmentId: string): Subject<RequestLogView> {
    const existing = this.streams.get(environmentId);
    if (existing) return existing;

    const stream = new Subject<RequestLogView>();
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
