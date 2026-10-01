import { Injectable, NotFoundException } from '@nestjs/common';
import { Subject } from 'rxjs';
import { Prisma } from '@generated/client';
import { DbService } from '@src/db/db.service';
import type {
  PaginatedResult,
  RequestLogEntry,
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
  private readonly streams = new Map<string, Subject<RequestLogEntry>>();

  constructor(private readonly db: DbService) {}

  async append(entry: RequestLogEntry): Promise<RequestLogEntry> {
    const created = await this.db.requestLog.create({
      data: {
        ...entry,
        method: entry.method.toUpperCase(),
      },
    });

    const stream = this.streams.get(entry.environmentId);
    if (stream) stream.next(created);

    return created;
  }

  async subscribeForUser(
    environmentId: string,
    userId: string,
  ): Promise<Subject<RequestLogEntry>> {
    await this.verifyEnvironmentOwnership(environmentId, userId);
    return this.subscribe(environmentId);
  }

  async findByEnvironment(
    environmentId: string,
    userId: string,
    filters: FilterRequestLogsDto,
  ): Promise<PaginatedResult<RequestLogEntry>> {
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

  private subscribe(environmentId: string): Subject<RequestLogEntry> {
    const existing = this.streams.get(environmentId);
    if (existing) return existing;

    const stream = new Subject<RequestLogEntry>();
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
