import * as mysql from 'mysql2/promise';
import type {
  DatabaseDriver,
  PaginatedRows,
  PaginationOptions,
  QueryResult,
  TableColumn,
  TableObject,
} from '@src/common/types/workbench';

function quoteIdentifier(value: string): string {
  return `\`${value.replace(/`/g, '``')}\``;
}

export class MysqlDriver implements DatabaseDriver {
  private connection: mysql.Connection;
  private readonly url: string;

  constructor(credentials: Record<string, string>) {
    this.url = MysqlDriver.findConnectionUrl(credentials);
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
    this.connection = await mysql.createConnection({ uri: this.url });
  }

  async execute(query: string): Promise<QueryResult> {
    const [rows, fields] = await this.connection.execute(query);

    const fieldArray = Array.isArray(fields) ? fields : [];

    return {
      columns: fieldArray.map((field: { name: string }) => ({
        name: field.name,
      })),
      rows: Array.isArray(rows) ? rows : [],
      rowCount: Array.isArray(rows) ? rows.length : 0,
    };
  }

  async listDatabases(): Promise<string[]> {
    const [rows] = await this.connection.execute('SHOW DATABASES');

    return (rows as { Database: string }[]).map((row) => row.Database);
  }

  async listTables(database?: string): Promise<TableObject[]> {
    const db = database ?? (await this.getCurrentDatabase());
    const [rows] = await this.connection.execute(
      `SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = ?`,
      [db],
    );

    return (rows as { TABLE_NAME: string }[]).map((row) => ({
      name: row.TABLE_NAME,
      type: 'table',
      schema: db,
    }));
  }

  async describeTable(
    name: string,
    database?: string,
  ): Promise<{ columns: TableColumn[] }> {
    const [schemaPart, tablePart] = name.includes('.')
      ? name.split('.')
      : [database ?? (await this.getCurrentDatabase()), name];
    const table = tablePart ?? name;

    const [rows] = await this.connection.execute(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY
       FROM information_schema.columns
       WHERE table_schema = ? AND table_name = ?
       ORDER BY ORDINAL_POSITION`,
      [schemaPart, table],
    );

    const columns = (
      rows as {
        COLUMN_NAME: string;
        DATA_TYPE: string;
        IS_NULLABLE: string;
        COLUMN_DEFAULT: string | null;
        COLUMN_KEY: string;
      }[]
    ).map((row) => ({
      name: row.COLUMN_NAME,
      type: row.DATA_TYPE,
      nullable: row.IS_NULLABLE === 'YES',
      default: row.COLUMN_DEFAULT,
      primaryKey: row.COLUMN_KEY === 'PRI',
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
      : [await this.getCurrentDatabase(), name];
    const safeTable = `${quoteIdentifier(schemaPart)}.${quoteIdentifier(tablePart ?? name)}`;

    const [countRows] = await this.connection.execute(
      `SELECT COUNT(*) as total FROM ${safeTable}`,
    );
    const total = Number((countRows as { total: number }[])[0].total);

    const [rows] = await this.connection.execute(
      `SELECT * FROM ${safeTable} LIMIT ? OFFSET ?`,
      [limit, offset],
    );

    const totalPages = Math.ceil(total / limit);

    return {
      columns,
      rows: rows as Record<string, unknown>[],
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
    await this.connection?.end();
  }

  private async getCurrentDatabase(): Promise<string> {
    const [rows] = await this.connection.execute('SELECT DATABASE() as db');
    return (rows as { db: string }[])[0]?.db ?? '';
  }
}
