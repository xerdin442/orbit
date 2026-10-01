import { Document, MongoClient, ObjectId } from 'mongodb';
import { parseFilter } from 'mongodb-query-parser';
import type {
  DatabaseDriver,
  MongoCollectionInfo,
  MongoFieldSchema,
  MongoIndex,
  PaginatedRows,
  PaginationOptions,
  QueryResult,
  TableColumn,
  TableObject,
} from '@src/common/types/workbench';

const SHELL_QUERY_PATTERN =
  /^\s*db\.(\w+)\.(find|findOne|aggregate|count|countDocuments|estimatedDocumentCount|distinct|explain)\s*\(([\s\S]*)\)\s*;?\s*$/;

const BANNED_OPERATORS = new Set([
  '$merge',
  '$out',
  '$where',
  '$function',
  '$accumulator',
]);

function assertNoBannedOperators(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) assertNoBannedOperators(item);
    return;
  }

  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (BANNED_OPERATORS.has(key)) {
        throw new Error(
          `Operator "${key}" is not allowed in the read-only Workbench.`,
        );
      }
      assertNoBannedOperators(nested);
    }
  }
}

function splitTopLevelArgs(raw: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = '';

  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];

    if (quote) {
      current += char;
      if (char === '\\') {
        current += raw[++i] ?? '';
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      current += char;
      continue;
    }

    if (char === '{' || char === '[' || char === '(') depth++;
    if (char === '}' || char === ']' || char === ')') depth--;

    if (char === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim().length > 0) args.push(current.trim());
  return args;
}

export class MongoDriver implements DatabaseDriver {
  private client: MongoClient;
  private readonly url: string;

  constructor(credentials: Record<string, string>) {
    this.url = MongoDriver.findConnectionUrl(credentials);
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
    this.client = new MongoClient(this.url);
    await this.client.connect();
  }

  async execute(query: string): Promise<QueryResult> {
    const {
      collection: collectionName,
      operation,
      args,
    } = this.parseShellQuery(query);

    const db = this.client.db();
    const collection = db.collection(collectionName);

    let result: unknown;

    switch (operation) {
      case 'find': {
        const filter = (args[0] as Document) ?? {};
        assertNoBannedOperators(filter);
        result = await collection.find(filter).toArray();
        break;
      }
      case 'findOne': {
        const filter = (args[0] as Document) ?? {};
        assertNoBannedOperators(filter);
        result = await collection.findOne(filter);
        break;
      }
      case 'aggregate': {
        const pipeline = (args[0] as Document[]) ?? [];
        assertNoBannedOperators(pipeline);
        result = await collection.aggregate(pipeline).toArray();
        break;
      }
      case 'count':
      case 'countDocuments': {
        const filter = (args[0] as Document) ?? {};
        assertNoBannedOperators(filter);
        result = await collection.countDocuments(filter);
        break;
      }
      case 'estimatedDocumentCount':
        result = await collection.estimatedDocumentCount();
        break;
      case 'distinct': {
        const field = (args[0] as string) ?? '';
        const filter = (args[1] as Document) ?? {};
        assertNoBannedOperators(filter);
        result = await collection.distinct(field, filter);
        break;
      }
      case 'explain': {
        const filter = (args[0] as Document) ?? {};
        assertNoBannedOperators(filter);
        result = await collection.find(filter).explain();
        break;
      }
      default:
        throw new Error(`Unsupported MongoDB operation: ${operation}`);
    }

    const rows = Array.isArray(result) ? result : [result];
    const columns = this.inferColumns(rows);

    return {
      columns,
      rows,
      rowCount: rows.length,
    };
  }

  async listDatabases(): Promise<string[]> {
    const result = await this.client.db().admin().listDatabases();
    return result.databases.map((db: { name: string }) => db.name);
  }

  async listTables(database?: string): Promise<TableObject[]> {
    const db = database ? this.client.db(database) : this.client.db();
    const collections = await db.listCollections().toArray();

    const result: MongoCollectionInfo[] = [];

    for (const col of collections) {
      let documentCount: number | undefined;
      try {
        documentCount = await db.collection(col.name).estimatedDocumentCount();
      } catch {
        // skip if stats unavailable
      }

      result.push({
        name: col.name,
        type: 'collection',
        schema: database ?? '',
        documentCount,
      });
    }

    return result;
  }

  async describeTable(
    name: string,
    database?: string,
  ): Promise<{ columns: TableColumn[] }> {
    const db = database ? this.client.db(database) : this.client.db();
    const indexes = await db.collection(name).indexes();
    const sample = await db.collection(name).findOne({});

    const primaryKeys = (indexes as MongoIndex[])
      .filter(
        (idx) =>
          idx.key && Object.values(idx.key).includes(1) && idx.name === '_id_',
      )
      .flatMap((idx) => Object.keys(idx.key));

    const columns: MongoFieldSchema[] = sample
      ? Object.entries(sample).map(([key, value]) => ({
          ...this.inferFieldSchema(value),
          name: key,
          primaryKey: primaryKeys.includes(key),
        }))
      : [{ name: '_id', type: 'objectId', primaryKey: true }];

    return { columns };
  }

  async paginateData(
    name: string,
    options: PaginationOptions,
  ): Promise<PaginatedRows> {
    const { columns } = await this.describeTable(name);
    const limit = Math.min(options.limit, 50);
    const offset = (options.page - 1) * limit;

    const db = this.client.db();
    const collection = db.collection(name);

    const filter = (options.filter as Record<string, unknown>) ?? {};

    const total = await collection.countDocuments(filter);

    const rows = await collection
      .find(filter)
      .skip(offset)
      .limit(limit)
      .toArray();

    const totalPages = Math.ceil(total / limit);

    return {
      columns,
      rows: rows,
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
    await this.client?.close();
  }

  private parseShellQuery(query: string): {
    collection: string;
    operation: string;
    args: unknown[];
  } {
    const match = SHELL_QUERY_PATTERN.exec(query);
    if (!match) {
      throw new Error(
        'Invalid query. Expected shell syntax like db.<collection>.find({ ... }).',
      );
    }

    const [, collectionName, operation, rawArgs] = match;
    const args: unknown[] = splitTopLevelArgs(rawArgs).map(
      (arg): unknown => parseFilter(arg) as unknown,
    );

    return { collection: collectionName, operation, args };
  }

  private inferFieldSchema(value: unknown): MongoFieldSchema {
    if (value === null || value === undefined) {
      return { name: '', type: 'null' };
    }

    if (value instanceof ObjectId) {
      return { name: '', type: 'objectId' };
    }

    if (value instanceof Date) {
      return { name: '', type: 'date' };
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return { name: '', type: 'array', arrayOf: { name: '', type: 'null' } };
      }

      return {
        name: '',
        type: 'array',
        arrayOf: this.inferFieldSchema(value[0]),
      };
    }

    if (typeof value === 'object') {
      const fields = Object.entries(value as Record<string, unknown>).map(
        ([key, val]) => {
          const field = this.inferFieldSchema(val);
          field.name = key;
          return field;
        },
      );

      return { name: '', type: 'object', fields };
    }

    return { name: '', type: typeof value as MongoFieldSchema['type'] };
  }

  private inferColumns(rows: unknown[]): { name: string; type?: string }[] {
    const keyMap = new Map<string, unknown>();

    for (const row of rows) {
      if (row && typeof row === 'object') {
        for (const [key, value] of Object.entries(
          row as Record<string, unknown>,
        )) {
          if (!keyMap.has(key)) {
            keyMap.set(key, value);
          }
        }
      }
    }

    return Array.from(keyMap.entries()).map(([name, value]) => {
      const field = this.inferFieldSchema(value);
      field.name = name;
      return field;
    });
  }
}
