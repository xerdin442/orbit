import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';

dotenv.config();

const config = new ConfigService();

interface SecretsConfig {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  ENCRYPTION_KEY: string;
  REDIS_PORT: number;
  REDIS_HOST: string;
  REDIS_PASSWORD: string;
  REDIS_URL: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GITHUB_REDIRECT_URI: string;
  DOCKER_SOCKET: string;
  CADDY_ADMIN_URL: string;
  RATE_LIMITING_PER_SECOND: number;
  RATE_LIMITING_PER_MINUTE: number;
  PAYSTACK_SECRET_KEY: string;
}

function getString(key: string): string {
  return config.getOrThrow<string>(key);
}

function getNumber(key: string): number {
  return config.getOrThrow<number>(key);
}

export const Secrets: SecretsConfig = {
  NODE_ENV: process.env.NODE_ENV as string,
  PORT: getNumber('PORT'),
  DATABASE_URL: getString('DATABASE_URL'),
  JWT_SECRET: getString('JWT_SECRET'),
  ENCRYPTION_KEY: getString('ENCRYPTION_KEY'),
  REDIS_PORT: getNumber('REDIS_PORT'),
  REDIS_HOST: getString('REDIS_HOST'),
  REDIS_PASSWORD: getString('REDIS_PASSWORD'),
  REDIS_URL: getString('REDIS_URL'),
  GITHUB_CLIENT_ID: getString('GITHUB_CLIENT_ID'),
  GITHUB_CLIENT_SECRET: getString('GITHUB_CLIENT_SECRET'),
  GITHUB_REDIRECT_URI: getString('GITHUB_REDIRECT_URI'),
  DOCKER_SOCKET: getString('DOCKER_SOCKET'),
  CADDY_ADMIN_URL: getString('CADDY_ADMIN_URL'),
  RATE_LIMITING_PER_SECOND: getNumber('RATE_LIMITING_PER_SECOND'),
  RATE_LIMITING_PER_MINUTE: getNumber('RATE_LIMITING_PER_MINUTE'),
  PAYSTACK_SECRET_KEY: getString('PAYSTACK_SECRET_KEY'),
};
