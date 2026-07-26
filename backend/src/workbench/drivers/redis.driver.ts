import { createClient, type RedisClientType } from 'redis';
import type {
  DatabaseDriver,
  PaginatedRows,
  PaginationOptions,
  QueryResult,
  TableColumn,
  TableObject,
} from '@src/common/types/workbench';

function parseRedisCommand(query: string): string[] {
  return query.trim().split(/\s+/).filter(Boolean);
}

export class RedisDriver implements DatabaseDriver {
  private client: RedisClientType;
  private readonly url: string;

  constructor(credentials: Record<string, string>) {
    this.url = RedisDriver.findConnectionUrl(credentials);
  }

  private static findConnectionUrl(
    credentials: Record<string, string>,
  ): string {
    for (const key of Object.keys(credentials)) {
      const upper = key.toUpperCase();
      if (upper.includes('URL') || upper.includes('URI')) {
        return credentials[key];
      }
    }

    throw new Error('No connection URL found in credentials');
  }

  async connect(): Promise<void> {
    this.client = createClient({ url: this.url });
    await this.client.connect();
  }

  async execute(query: string): Promise<QueryResult> {
    const parts = parseRedisCommand(query);
    const [command, ...args] = parts;
    const upperCommand = command?.toUpperCase() ?? '';

    const result = await this.client.sendCommand([upperCommand, ...args]);

    return {
      columns: [{ name: 'result' }],
      rows: [{ result: this.serializeRedisResult(result) }],
      rowCount: 1,
    };
  }

  async listDatabases(): Promise<string[]> {
    const info = await this.client.info('keyspace');
    const lines = info.split('\n');
    const databases: string[] = [];

    for (const line of lines) {
      const match = line.match(/^db(\d+):/);
      if (match) {
        databases.push(`db${match[1]}`);
      }
    }

    if (databases.length === 0) {
      databases.push('db0');
    }

    return databases;
  }

  async listTables(): Promise<TableObject[]> {
    const result = await this.client.sendCommand([
      'SCAN',
      '0',
      'COUNT',
      '1000',
    ]);
    const scanResult = Array.isArray(result)
      ? (result as [string, string[]])
      : null;
    const keys = scanResult?.[1] ?? [];
    const grouped = new Map<string, number>();

    for (const key of keys) {
      const prefix = this.extractKeyPrefix(key);
      grouped.set(prefix, (grouped.get(prefix) ?? 0) + 1);
    }

    return Array.from(grouped.entries()).map(([name, count]) => ({
      name,
      type: 'key',
      schema: `${count} keys`,
    }));
  }

  async describeTable(name: string): Promise<{ columns: TableColumn[] }> {
    const type = await this.client.sendCommand(['TYPE', name]);

    return {
      columns: [
        { name: 'key', type: 'string' },
        { name: 'type', type: 'string' },
        { name: 'value', type: (type as string) ?? 'string' },
      ],
    };
  }

  async paginateData(
    name: string,
    options: PaginationOptions,
  ): Promise<PaginatedRows> {
    const limit = Math.min(options.limit, 100);
    const offset = (options.page - 1) * limit;

    const keys: string[] = [];
    let cursor = '0';

    do {
      const result = await this.client.sendCommand([
        'SCAN',
        cursor,
        'MATCH',
        name,
        'COUNT',
        '1000',
      ]);
      cursor = result[0] as string;
      keys.push(...(result[1] as string[]));
    } while (cursor !== '0' && keys.length < offset + limit);

    const selectedKeys = keys.slice(offset, offset + limit);
    const rows: Record<string, unknown>[] = [];

    for (const key of selectedKeys) {
      const type = await this.client.sendCommand(['TYPE', key]);
      let value: unknown;

      switch ((type as string).toLowerCase()) {
        case 'string':
          value = await this.client.sendCommand(['GET', key]);
          break;
        case 'hash':
          value = await this.client.sendCommand(['HGETALL', key]);
          break;
        case 'list':
          value = await this.client.sendCommand(['LRANGE', key, '0', '-1']);
          break;
        case 'set':
          value = await this.client.sendCommand(['SMEMBERS', key]);
          break;
        case 'zset':
          value = await this.client.sendCommand([
            'ZRANGE',
            key,
            '0',
            '-1',
            'WITHSCORES',
          ]);
          break;
        default:
          value = null;
      }

      rows.push({
        key,
        type: type,
        value: this.serializeRedisResult(value),
      });
    }

    const total = keys.length;
    const totalPages = Math.ceil(total / limit);

    return {
      columns: [
        { name: 'key', type: 'string' },
        { name: 'type', type: 'string' },
        { name: 'value', type: 'string' },
      ],
      rows,
      meta: {
        total,
        page: options.page,
        limit,
        totalPages,
        hasNextPage: options.page < totalPages,
        hasPrevPage: options.page > 1,
      },
    };
  }

  async close(): Promise<void> {
    await this.client?.disconnect();
  }

  private extractKeyPrefix(key: string): string {
    const separator = key.includes(':') ? ':' : key.includes('-') ? '-' : '';
    if (!separator) return key;

    const parts = key.split(separator);
    return parts.length > 1 ? `${parts[0]}${separator}*` : key;
  }

  private serializeRedisResult(result: unknown): unknown {
    if (result instanceof Buffer) {
      return result.toString('utf-8');
    }

    if (Array.isArray(result)) {
      return result.map((item) => this.serializeRedisResult(item));
    }

    return result;
  }
}
