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
  GITHUB_APP_ID: string;
  GITHUB_APP_SLUG: string;
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_WEBHOOK_SECRET: string;
  FRONTEND_URL: string;
  DOCKER_SOCKET: string;
  CADDY_ADMIN_URL: string;
  CADDY_CONTAINER_NAME: string;
  INGRESS_HOST: string;
  INGRESS_IP: string;
  POSTGRES_IMAGE_TAG: string;
  MYSQL_IMAGE_TAG: string;
  REDIS_IMAGE_TAG: string;
  MONGO_IMAGE_TAG: string;
  RATE_LIMITING_PER_SECOND: number;
  RATE_LIMITING_PER_MINUTE: number;
  MAX_CUSTOM_DOMAINS: number;
  SLACK_CLIENT_ID: string;
  SLACK_CLIENT_SECRET: string;
  SLACK_SIGNING_SECRET: string;
  SLACK_APP_TOKEN: string;
  SLACK_REDIRECT_URI: string;
  SLACK_BOT_SCOPES: string;
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
  GITHUB_APP_ID: getString('GITHUB_APP_ID'),
  GITHUB_APP_SLUG: getString('GITHUB_APP_SLUG'),
  GITHUB_APP_PRIVATE_KEY: getString('GITHUB_APP_PRIVATE_KEY'),
  GITHUB_WEBHOOK_SECRET: getString('GITHUB_WEBHOOK_SECRET'),
  FRONTEND_URL: getString('FRONTEND_URL'),
  DOCKER_SOCKET: getString('DOCKER_SOCKET'),
  CADDY_ADMIN_URL: getString('CADDY_ADMIN_URL'),
  CADDY_CONTAINER_NAME: getString('CADDY_CONTAINER_NAME'),
  INGRESS_HOST: getString('INGRESS_HOST'),
  INGRESS_IP: getString('INGRESS_IP'),
  POSTGRES_IMAGE_TAG: getString('POSTGRES_IMAGE_TAG'),
  MYSQL_IMAGE_TAG: getString('MYSQL_IMAGE_TAG'),
  REDIS_IMAGE_TAG: getString('REDIS_IMAGE_TAG'),
  MONGO_IMAGE_TAG: getString('MONGO_IMAGE_TAG'),
  RATE_LIMITING_PER_SECOND: getNumber('RATE_LIMITING_PER_SECOND'),
  RATE_LIMITING_PER_MINUTE: getNumber('RATE_LIMITING_PER_MINUTE'),
  MAX_CUSTOM_DOMAINS: getNumber('MAX_CUSTOM_DOMAINS'),
  SLACK_CLIENT_ID: getString('SLACK_CLIENT_ID'),
  SLACK_CLIENT_SECRET: getString('SLACK_CLIENT_SECRET'),
  SLACK_SIGNING_SECRET: getString('SLACK_SIGNING_SECRET'),
  SLACK_APP_TOKEN: getString('SLACK_APP_TOKEN'),
  SLACK_REDIRECT_URI: getString('SLACK_REDIRECT_URI'),
  SLACK_BOT_SCOPES: getString('SLACK_BOT_SCOPES'),
};
