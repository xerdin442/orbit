/// <reference types="jest" />

import 'reflect-metadata';
import 'dotenv/config';

jest.mock('@src/common/secrets', () => ({
  Secrets: {
    NODE_ENV: 'test',
    PORT: 3000,
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/postgres',
    JWT_SECRET: 'test-jwt-secret',
    ENCRYPTION_KEY:
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    REDIS_PASSWORD: 'test-redis-password',
    REDIS_URL: 'redis://:test-redis-password@localhost:6379',
    GITHUB_CLIENT_ID: 'test-client-id',
    GITHUB_CLIENT_SECRET: 'test-client-secret',
    GITHUB_REDIRECT_URI: 'http://localhost:3000/api/auth/github/callback',
    GITHUB_APP_ID: '12345',
    GITHUB_APP_SLUG: 'orbit-deploy',
    GITHUB_APP_PRIVATE_KEY: 'test-private-key',
    GITHUB_WEBHOOK_SECRET: 'test-webhook-secret',
    FRONTEND_URL: 'http://localhost:5173',
    DOCKER_SOCKET: '/var/run/docker.sock',
    CADDY_ADMIN_URL: 'http://localhost:2019',
    CADDY_CONTAINER_NAME: 'orbit-caddy',
    INGRESS_HOST: '192.168.1.55.sslip.io',
    INGRESS_IP: '192.168.1.55',
    POSTGRES_IMAGE_TAG: 'postgres:16-alpine',
    MYSQL_IMAGE_TAG: 'mysql:8.4',
    REDIS_IMAGE_TAG: 'redis:7-alpine',
    MONGO_IMAGE_TAG: 'mongo:7',
    RATE_LIMITING_PER_SECOND: 100,
    RATE_LIMITING_PER_MINUTE: 1000,
    SLACK_CLIENT_ID: 'test-slack-client-id',
    SLACK_CLIENT_SECRET: 'test-slack-client-secret',
    SLACK_SIGNING_SECRET: 'test-slack-signing-secret',
    SLACK_REDIRECT_URI: 'http://localhost:3000/api/slack/callback',
    SLACK_BOT_SCOPES: 'commands,chat:write',
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});
