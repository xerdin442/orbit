import { randomBytes } from 'crypto';
import { ThrottlerModuleOptions, ThrottlerOptions } from '@nestjs/throttler';
import { Secrets } from '@src/common/secrets';

export const randomAlphanumeric = (length: number): string => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = randomBytes(length);

  let result = '';
  for (let i = 0; i < length; i++) {
    result += alphabet[bytes[i] % alphabet.length];
  }

  return result;
};

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

export const splitHostname = (
  hostname: string,
): { isApex: boolean; recordName: string } => {
  const labels = hostname.split('.');

  if (labels.length <= 2) {
    return { isApex: true, recordName: '@' };
  }

  return { isApex: false, recordName: labels.slice(0, -2).join('.') };
};
