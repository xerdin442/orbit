import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { DbService } from '@src/db/db.service';
import { LogLevel, type DeploymentLog } from '@generated/client';

@Injectable()
export class LogService {
  private readonly streams = new Map<string, Subject<DeploymentLog>>();

  constructor(private readonly db: DbService) {}

  async append(
    deploymentId: string,
    level: LogLevel,
    message: string,
  ): Promise<DeploymentLog> {
    const entry = await this.db.deploymentLog.create({
      data: { deploymentId, level, message },
    });

    const stream = this.streams.get(deploymentId);
    if (stream) stream.next(entry);

    return entry;
  }

  subscribe(deploymentId: string): Subject<DeploymentLog> {
    const existing = this.streams.get(deploymentId);
    if (existing) return existing;

    const stream = new Subject<DeploymentLog>();
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

  async getLogs(deploymentId: string): Promise<DeploymentLog[]> {
    return this.db.deploymentLog.findMany({
      where: { deploymentId },
      orderBy: { timestamp: 'asc' },
    });
  }
}
