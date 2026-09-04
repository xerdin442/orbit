import { ResourceType } from '@generated/client';
import { Secrets } from '@src/common/secrets';

export const IMAGE_MAP: Record<ResourceType, string> = {
  postgres: Secrets.POSTGRES_IMAGE_TAG,
  mysql: Secrets.MYSQL_IMAGE_TAG,
  redis: Secrets.REDIS_IMAGE_TAG,
  mongo: Secrets.MONGO_IMAGE_TAG,
};

export const INTERNAL_PORT: Record<ResourceType, number> = {
  postgres: 5432,
  mysql: 3306,
  redis: 6379,
  mongo: 27017,
};

export const MOUNT_PATH: Record<ResourceType, string> = {
  postgres: '/var/lib/postgresql/data',
  mysql: '/var/lib/mysql',
  redis: '/data',
  mongo: '/data/db',
};

export const HEALTHCHECK_TEST: Record<ResourceType, string[]> = {
  postgres: ['CMD', 'pg_isready', '-U', 'orbit', '-d', 'orbit', '-q'],
  mysql: ['CMD', 'mysqladmin', 'ping', '-h', '127.0.0.1'],
  redis: ['CMD', 'redis-cli', 'ping'],
  mongo: ['CMD', 'mongosh', '--quiet', '--eval', 'db.adminCommand("ping").ok'],
};
