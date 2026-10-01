import { MongoClient } from 'mongodb';
import type {
  DatabaseDriver,
  MongoIndex,
  MongoQueryCommand,
  PaginatedRows,
  PaginationOptions,
  QueryResult,
  TableColumn,
  TableObject,
} from '@src/common/types/workbench';

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
    const command = JSON.parse(query) as MongoQueryCommand;
    const db = this.client.db();
    const collection = db.collection(command.collection);

    let result: unknown;

    switch (command.operation) {
      case 'find':
        result = await collection.find(command.filter ?? {}).toArray();
        break;
      case 'findOne':
        result = await collection.findOne(command.filter ?? {});
        break;
      case 'aggregate':
        result = await collection.aggregate(command.pipeline ?? []).toArray();
        break;
      case 'count':
      case 'countDocuments':
        result = await collection.countDocuments(command.filter ?? {});
        break;
      case 'distinct':
        result = await collection.distinct(
          command.field ?? '',
          command.filter ?? {},
        );
        break;
      default:
        throw new Error(
          `Unsupported MongoDB operation: ${command.operation as string}`,
        );
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

    return collections.map((col: { name: string }) => ({
      name: col.name,
      type: 'collection',
      schema: database ?? '',
    }));
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

    const columns = sample
      ? Object.entries(sample).map(([key, value]) => ({
          name: key,
          type: typeof value,
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
    const limit = Math.min(options.limit, 100);
    const offset = (options.page - 1) * limit;

    const db = this.client.db();
    const collection = db.collection(name);

    const total = await collection.countDocuments();

    const rows = await collection.find({}).skip(offset).limit(limit).toArray();

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

  private inferColumns(rows: unknown[]): { name: string; type?: string }[] {
    const keys = new Set<string>();

    for (const row of rows) {
      if (row && typeof row === 'object') {
        for (const key of Object.keys(row)) {
          keys.add(key);
        }
      }
    }

    return Array.from(keys).map((name) => ({ name }));
  }
}
