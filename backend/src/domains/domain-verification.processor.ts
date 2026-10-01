import { Processor, WorkerHost } from '@nestjs/bullmq';
import { resolve4, resolveCname } from 'dns';
import { promisify } from 'util';
import { Logger } from '@src/common/logger';
import { DbService } from '@src/db/db.service';
import { CaddyService } from '@src/infrastructure/caddy.service';
import { ActivityService } from '@src/activity/activity.service';
import { Secrets } from '@src/common/secrets';
import { ActivityType, DomainStatus } from '@generated/client';

const dnsResolve4 = promisify(resolve4);
const dnsResolveCname = promisify(resolveCname);
const FAILURE_TIMEOUT_MS = 30 * 60 * 1000;

@Processor('domains')
export class DomainVerificationProcessor extends WorkerHost {
  private readonly logger = Logger(DomainVerificationProcessor.name);

  constructor(
    private readonly db: DbService,
    private readonly caddy: CaddyService,
    private readonly activity: ActivityService,
  ) {
    super();
  }

  async process(): Promise<void> {
    const domains = await this.db.domain.findMany({
      where: {
        status: { in: [DomainStatus.pending, DomainStatus.verifying] },
      },
    });

    for (const domain of domains) {
      try {
        if (domain.status === DomainStatus.pending) {
          await this.db.domain.update({
            where: { id: domain.id },
            data: { status: DomainStatus.verifying },
          });
        }

        const parts = domain.hostname.split('.');
        const isApex = parts.length <= 2;

        let verified = false;

        try {
          if (isApex) {
            const addresses = await dnsResolve4(domain.hostname);
            verified = addresses.includes(Secrets.INGRESS_IP);
          } else {
            const cnames = await dnsResolveCname(domain.hostname);
            verified = cnames.includes(Secrets.INGRESS_HOST);
          }
        } catch {
          // DNS resolution failed, check for retry or mark as failed
        }

        if (verified) {
          await this.db.domain.update({
            where: { id: domain.id },
            data: { status: DomainStatus.active, verifiedAt: new Date() },
          });

          await this.caddy.syncEnvironment(domain.environmentId);

          await this.activity.log(ActivityType.domain_verified, 'system', {
            domainId: domain.id,
            hostname: domain.hostname,
            environmentId: domain.environmentId,
          });
        } else {
          const shouldFail =
            Date.now() - domain.createdAt.getTime() > FAILURE_TIMEOUT_MS;

          if (shouldFail) {
            await this.db.domain.update({
              where: { id: domain.id },
              data: { status: DomainStatus.failed },
            });

            this.logger.info(`Domain verification failed: ${domain.hostname}`);
          }
        }
      } catch (error) {
        this.logger.error(
          `Verification error for ${domain.hostname}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
}
