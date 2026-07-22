import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { DbService } from '@src/db/db.service';
import { LogLevel } from '@generated/client';
import type { LogEntry } from '@src/common/types';

@Injectable()
export class LogService {
  private readonly streams = new Map<string, Subject<LogEntry>>();

  constructor(private readonly db: DbService) {}

  async append(
    deploymentId: string,
    level: LogLevel,
    message: string,
  ): Promise<LogEntry> {
    const entry = await this.db.deploymentLog.create({
      data: { deploymentId, level, message },
    });

    const stream = this.streams.get(deploymentId);
    if (stream) stream.next(entry);

    return entry;
  }

  subscribe(deploymentId: string): Subject<LogEntry> {
    const existing = this.streams.get(deploymentId);
    if (existing) return existing;

    const stream = new Subject<LogEntry>();
    this.streams.set(deploymentId, stream);
    return stream;
  }

  complete(deploymentId: string): void {
    const stream = this.streams.get(deploymentId);
    if (stream) {
      stream.complete();
      this.streams.delete(deploymentId);
    }
  }

  async getLogs(deploymentId: string): Promise<LogEntry[]> {
    return this.db.deploymentLog.findMany({
      where: { deploymentId },
      orderBy: { timestamp: 'asc' },
    });
  }
}
