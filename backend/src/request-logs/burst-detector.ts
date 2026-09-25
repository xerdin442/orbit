import {
  BURST_ERROR_RATIO_THRESHOLD,
  BURST_EXEMPT_PATHS,
  BURST_MIN_REQUESTS,
  BURST_WINDOW_MS,
} from './filters';

interface RequestRecord {
  timestamp: number;
  isError: boolean;
}

export interface BurstVerdict {
  /** This request is part of a burst and must not be stored. */
  dropped: boolean;
  /** This request is the one that tripped the detector for its IP. The caller
   * should purge rows the IP already got stored before crossing the threshold. */
  newlyFlagged: boolean;
}

export class BurstDetector {
  private readonly requestsByIp = new Map<string, RequestRecord[]>();
  private readonly flaggedIps = new Set<string>();

  evaluate(
    clientIp: string | undefined,
    path: string,
    statusCode: number,
  ): BurstVerdict {
    if (!clientIp || BURST_EXEMPT_PATHS.includes(path)) {
      return { dropped: false, newlyFlagged: false };
    }

    const now = Date.now();
    const windowStart = now - BURST_WINDOW_MS;

    const recent = (this.requestsByIp.get(clientIp) ?? []).filter(
      (record) => record.timestamp >= windowStart,
    );
    recent.push({ timestamp: now, isError: statusCode >= 400 });
    this.requestsByIp.set(clientIp, recent);

    const errorCount = recent.filter((record) => record.isError).length;
    const dropped =
      recent.length >= BURST_MIN_REQUESTS &&
      errorCount / recent.length >= BURST_ERROR_RATIO_THRESHOLD;

    if (!dropped) {
      this.flaggedIps.delete(clientIp);
      return { dropped: false, newlyFlagged: false };
    }

    const newlyFlagged = !this.flaggedIps.has(clientIp);
    this.flaggedIps.add(clientIp);
    return { dropped: true, newlyFlagged };
  }

  prune(): void {
    const windowStart = Date.now() - BURST_WINDOW_MS;

    for (const [ip, records] of this.requestsByIp) {
      const recent = records.filter(
        (record) => record.timestamp >= windowStart,
      );

      if (recent.length === 0) {
        this.requestsByIp.delete(ip);
        this.flaggedIps.delete(ip);
      } else {
        this.requestsByIp.set(ip, recent);
      }
    }
  }
}
