import { ThrottlerModuleOptions, ThrottlerOptions } from '@nestjs/throttler';
import { Secrets } from '../secrets';

export const applyThrottlerConfig = (): ThrottlerModuleOptions => {
  const throttles: ThrottlerOptions[] = [
    {
      name: 'Seconds',
      ttl: 1000,
      limit: Secrets.RATE_LIMITING_PER_SECOND,
    },
    {
      name: 'Minutes',
      ttl: 60000,
      limit: Secrets.RATE_LIMITING_PER_MINUTE,
    },
  ];

  return Secrets.NODE_ENV !== 'test' ? throttles : [];
};
