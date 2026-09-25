import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as readline from 'readline';
import { DockerService } from '@src/infrastructure/docker.service';
import { CaddyService } from '@src/infrastructure/caddy.service';
import { DbService } from '@src/db/db.service';
import { Secrets } from '@src/common/secrets';
import { Logger } from '@src/common/logger';
import { RequestLogsService } from './request-logs.service';
import { parseAccessLogLine } from './parse-access-log';
import { BurstDetector } from './burst-detector';
import { BURST_PURGE_WINDOW_MS, BURST_WINDOW_MS } from './filters';

const HOST_CACHE_TTL_MS = 60_000;
const RECONNECT_DELAY_MS = 5_000;
const BURST_PRUNE_INTERVAL_MS = BURST_WINDOW_MS * 3;

interface CachedHost {
  environmentId: string | null;
  cachedAt: number;
}

@Injectable()
export class RequestLogIngestService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = Logger(RequestLogIngestService.name);
  private readonly hostCache = new Map<string, CachedHost>();
  private readonly burstDetector = new BurstDetector();
  private burstPruneInterval?: NodeJS.Timeout;
  private stopped = false;

  constructor(
    private readonly docker: DockerService,
    private readonly caddy: CaddyService,
    private readonly db: DbService,
    private readonly requestLogs: RequestLogsService,
  ) {}

  onModuleInit(): void {
    void this.tailLoop();
    this.burstPruneInterval = setInterval(
      () => this.burstDetector.prune(),
      BURST_PRUNE_INTERVAL_MS,
    );
  }

  onModuleDestroy(): void {
    this.stopped = true;
    clearInterval(this.burstPruneInterval);
  }

  async resolveEnvironmentId(hostname: string): Promise<string | null> {
    const cached = this.hostCache.get(hostname);
    if (cached && Date.now() - cached.cachedAt < HOST_CACHE_TTL_MS) {
      return cached.environmentId;
    }

    const domain = await this.db.domain.findFirst({ where: { hostname } });
    const environmentId = domain?.environmentId ?? null;

    this.hostCache.set(hostname, { environmentId, cachedAt: Date.now() });
    return environmentId;
  }

  async handleLine(line: string): Promise<void> {
    const parsed = parseAccessLogLine(line);
    if (!parsed) return;

    const verdict = this.burstDetector.evaluate(
      parsed.clientIp,
      parsed.path,
      parsed.statusCode,
    );
    if (verdict.dropped) {
      if (verdict.newlyFlagged && parsed.clientIp) {
        await this.purgeBurst(parsed.clientIp);
      }
      return;
    }

    const environmentId = await this.resolveEnvironmentId(parsed.hostname);
    if (!environmentId) return;

    await this.requestLogs.append(environmentId, parsed);
  }

  private async purgeBurst(clientIp: string): Promise<void> {
    try {
      const removed = await this.requestLogs.deleteRecentByClientIp(
        clientIp,
        BURST_PURGE_WINDOW_MS,
      );
      this.logger.info(
        `Scan burst from ${clientIp}: purged ${removed} stored request log(s)`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to purge burst rows for ${clientIp}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async tailLoop(): Promise<void> {
    while (!this.stopped) {
      try {
        await this.tailOnce();
      } catch (error) {
        this.logger.error(
          `Caddy log stream error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      if (this.stopped) return;
      await new Promise((resolve) => setTimeout(resolve, RECONNECT_DELAY_MS));
    }
  }

  private async tailOnce(): Promise<void> {
    try {
      await this.caddy.enableAccessLogging();
    } catch (error) {
      this.logger.error(
        `Failed to enable Caddy access logging: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const stream = await this.docker.followContainerLogs(
      Secrets.CADDY_CONTAINER_NAME,
    );

    const rl = readline.createInterface({ input: stream });

    for await (const line of rl) {
      if (this.stopped) {
        rl.close();
        return;
      }
      await this.handleLine(line);
    }
  }
}
