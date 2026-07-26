import type { PaginatedResult } from './index';

export interface TableColumn {
  name: string;
  type: string;
  nullable?: boolean;
  default?: string | null;
  primaryKey?: boolean;
}

export interface TableObject {
  name: string;
  type: 'table' | 'collection' | 'key';
  schema?: string;
}

export interface DatabaseSchema {
  name: string;
  objects: TableObject[];
}

export interface QueryResult {
  columns: { name: string; type?: string }[];
  rows: unknown[];
  rowCount: number;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sort?: { column: string; direction: 'asc' | 'desc' }[];
  filter?: Record<string, unknown>;
}

export interface PaginatedRows {
  columns: TableColumn[];
  rows: Record<string, unknown>[];
  meta: PaginatedResult<unknown>['meta'];
}

export interface DatabaseDriver {
  connect(): Promise<void>;
  execute(query: string): Promise<QueryResult>;
  listDatabases(): Promise<string[]>;
  listTables(database?: string): Promise<TableObject[]>;
  describeTable(
    name: string,
    database?: string,
  ): Promise<{ columns: TableColumn[] }>;
  paginateData(
    name: string,
    options: PaginationOptions,
  ): Promise<PaginatedRows>;
  close(): Promise<void>;
}

export interface QueryWhitelist {
  resourceType: string;
  pattern: RegExp;
  description: string;
}

export const SQL_QUERY_WHITELIST: QueryWhitelist = {
  resourceType: 'sql',
  pattern: /^\s*(SELECT|SHOW|DESCRIBE|EXPLAIN)\b/i,
  description: 'SELECT, SHOW, DESCRIBE, and EXPLAIN statements',
};

export const REDIS_QUERY_WHITELIST: QueryWhitelist = {
  resourceType: 'redis',
  pattern:
    /^\s*(GET|HGET|HMGET|LRANGE|SMEMBERS|ZRANGE|ZRANGEBYSCORE|SCAN|KEYS|TYPE|TTL|INFO|DBSIZE|EXISTS|HLEN|LLEN|SCARD|ZCARD|HKEYS|HVALS|HGETALL|LRANGE|LINDEX|ZRANGE|ZREVRANGE|ZRANK|ZSCORE|MGET|SUBSTR|STRLEN)\b/i,
  description: 'read-only Redis commands',
};

export const MONGO_QUERY_WHITELIST: QueryWhitelist = {
  resourceType: 'mongo',
  pattern:
    /^\s*(find|aggregate|count|countDocuments|estimatedDocumentCount|distinct|findOne|explain)\b/i,
  description: 'read-only MongoDB operations',
};

export interface PgField {
  name: string;
  dataTypeID: number;
}

export interface MongoQueryCommand {
  collection: string;
  operation:
    'find' | 'aggregate' | 'count' | 'countDocuments' | 'distinct' | 'findOne';
  filter?: Record<string, unknown>;
  pipeline?: unknown[];
  options?: Record<string, unknown>;
  field?: string;
}

export interface MongoIndex {
  key: Record<string, unknown>;
  name: string;
}
