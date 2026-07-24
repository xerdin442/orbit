import { ResourceType } from '@generated/client';
import { ResourceDefaultKey } from '@src/common/types';

export const RESOURCE_DEFAULTS: Record<ResourceType, ResourceDefaultKey[]> = {
  postgres: [
    { key: 'DATABASE_URL', description: 'PostgreSQL connection URL' },
    { key: 'DATABASE_NAME', description: 'Database name' },
    { key: 'POSTGRES_HOST', description: 'Postgres host' },
    { key: 'POSTGRES_PORT', description: 'Postgres port' },
    { key: 'POSTGRES_USER', description: 'Postgres user' },
    { key: 'POSTGRES_PASSWORD', description: 'Postgres password' },
  ],
  mysql: [
    { key: 'DATABASE_URL', description: 'MySQL connection URL' },
    { key: 'DATABASE_NAME', description: 'Database name' },
    { key: 'MYSQL_HOST', description: 'MySQL host' },
    { key: 'MYSQL_PORT', description: 'MySQL port' },
    { key: 'MYSQL_USER', description: 'MySQL user' },
    { key: 'MYSQL_PASSWORD', description: 'MySQL password' },
    { key: 'MYSQL_ROOT_PASSWORD', description: 'MySQL root password' },
  ],
  redis: [
    { key: 'REDIS_URL', description: 'Redis connection URL' },
    { key: 'REDIS_HOST', description: 'Redis host' },
    { key: 'REDIS_PORT', description: 'Redis port' },
    { key: 'REDIS_PASSWORD', description: 'Redis password' },
  ],
  mongo: [
    { key: 'MONGO_URI', description: 'MongoDB connection URI' },
    { key: 'MONGO_HOST', description: 'MongoDB host' },
    { key: 'MONGO_PORT', description: 'MongoDB port' },
    { key: 'MONGO_USER', description: 'MongoDB user' },
    { key: 'MONGO_PASSWORD', description: 'MongoDB password' },
    { key: 'MONGO_DATABASE', description: 'MongoDB database name' },
  ],
};
