import { RESOURCE_DEFAULTS } from './defaults';
import { ResourceType } from '@generated/client';

describe('RESOURCE_DEFAULTS', () => {
  it('has all four resource types', () => {
    expect(Object.keys(RESOURCE_DEFAULTS)).toHaveLength(4);
    expect(RESOURCE_DEFAULTS).toHaveProperty(ResourceType.postgres);
    expect(RESOURCE_DEFAULTS).toHaveProperty(ResourceType.mysql);
    expect(RESOURCE_DEFAULTS).toHaveProperty(ResourceType.redis);
    expect(RESOURCE_DEFAULTS).toHaveProperty(ResourceType.mongo);
  });

  it('postgres has DATABASE_URL and DATABASE_NAME', () => {
    const keys = RESOURCE_DEFAULTS.postgres.map((d) => d.key);
    expect(keys).toContain('DATABASE_URL');
    expect(keys).toContain('DATABASE_NAME');
  });

  it('mysql has DATABASE_URL and MYSQL_HOST', () => {
    const keys = RESOURCE_DEFAULTS.mysql.map((d) => d.key);
    expect(keys).toContain('DATABASE_URL');
    expect(keys).toContain('MYSQL_HOST');
  });

  it('redis has REDIS_URL and REDIS_PASSWORD', () => {
    const keys = RESOURCE_DEFAULTS.redis.map((d) => d.key);
    expect(keys).toContain('REDIS_URL');
    expect(keys).toContain('REDIS_PASSWORD');
  });

  it('mongo has MONGO_URI', () => {
    const keys = RESOURCE_DEFAULTS.mongo.map((d) => d.key);
    expect(keys).toContain('MONGO_URI');
  });

  it('every key has a description', () => {
    for (const type of Object.values(ResourceType)) {
      for (const entry of RESOURCE_DEFAULTS[type]) {
        expect(entry.key).toBeTruthy();
        expect(entry.description).toBeTruthy();
      }
    }
  });
});
