import { Client } from 'pg';
import type {
  DatabaseDriver,
  PaginatedRows,
  PaginationOptions,
  PgField,
  QueryResult,
  TableColumn,
  TableObject,
} from '@src/common/types/workbench';

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export class PostgresDriver implements DatabaseDriver {
  private client: Client;
  private readonly url: string;

  constructor(credentials: Record<string, string>) {
    this.url = PostgresDriver.findConnectionUrl(credentials);
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
    this.client = new Client({ connectionString: this.url });
    await this.client.connect();
  }

  async execute(query: string): Promise<QueryResult> {
    const result = await this.client.query(query);

    return {
      columns: (result.fields as PgField[]).map((field) => ({
        name: field.name,
      })),
      rows: result.rows as unknown[],
      rowCount: result.rowCount ?? result.rows.length,
    };
  }

  async listDatabases(): Promise<string[]> {
    const result = await this.client.query(
      'SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname',
    );
    return (result.rows as { datname: string }[]).map((row) => row.datname);
  }

  async listTables(): Promise<TableObject[]> {
    const result = await this.client.query(
      `SELECT table_schema, table_name
       FROM information_schema.tables
       WHERE table_type = 'BASE TABLE'
         AND table_schema NOT IN ('pg_catalog', 'information_schema')
       ORDER BY table_schema, table_name`,
    );

    return (result.rows as { table_schema: string; table_name: string }[]).map(
      (row) => ({
        name: row.table_name,
        type: 'table',
        schema: row.table_schema,
      }),
    );
  }

  async describeTable(
    name: string,
    database?: string,
  ): Promise<{ columns: TableColumn[] }> {
    const [schemaPart, tablePart] = name.includes('.')
      ? name.split('.')
      : ['public', name];
    const schema = database || schemaPart;
    const table = tablePart ?? name;

    const result = await this.client.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2
       ORDER BY ordinal_position`,
      [schema, table],
    );

    const columns = (
      result.rows as {
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default: string | null;
      }[]
    ).map((row) => ({
      name: row.column_name,
      type: row.data_type,
      nullable: row.is_nullable === 'YES',
      default: row.column_default,
    }));

    return { columns };
  }

  async paginateData(
    name: string,
    options: PaginationOptions,
  ): Promise<PaginatedRows> {
    const { columns } = await this.describeTable(name);
    const limit = Math.min(options.limit, 50);
    const offset = (options.page - 1) * limit;

    const [schemaPart, tablePart] = name.includes('.')
      ? name.split('.')
      : ['public', name];
    const safeTable = `${quoteIdentifier(schemaPart)}.${quoteIdentifier(tablePart ?? name)}`;

    const countResult = await this.client.query(
      `SELECT COUNT(*)::int as total FROM ${safeTable}`,
    );
    const total = (countResult.rows[0] as { total: number }).total;

    const result = await this.client.query(
      `SELECT * FROM ${safeTable} LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    const totalPages = Math.ceil(total / limit);

    return {
      columns,
      rows: result.rows as Record<string, unknown>[],
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
    await this.client?.end();
  }
}
