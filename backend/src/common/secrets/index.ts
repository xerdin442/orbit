import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Config Service
const config = new ConfigService();

export const Secrets = {
  NODE_ENV: process.env.NODE_ENV as string,
  PORT: config.getOrThrow<number>('PORT'),
  DATABASE_URL: config.getOrThrow<string>('DATABASE_URL'),
  JWT_SECRET: config.getOrThrow<string>('JWT_SECRET'),
  REDIS_PORT: config.getOrThrow<number>('REDIS_PORT'),
  REDIS_HOST: config.getOrThrow<string>('REDIS_HOST'),
  REDIS_PASSWORD: config.getOrThrow<string>('REDIS_PASSWORD'),
  REDIS_URL: config.getOrThrow<string>('REDIS_URL'),
  RATE_LIMITING_PER_SECOND: config.getOrThrow<number>(
    'RATE_LIMITING_PER_SECOND',
  ),
  RATE_LIMITING_PER_MINUTE: config.getOrThrow<number>(
    'RATE_LIMITING_PER_MINUTE',
  ),
  PAYSTACK_SECRET_KEY: config.getOrThrow<string>('PAYSTACK_SECRET_KEY'),
};
