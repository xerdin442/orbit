import * as mysql from 'mysql2/promise';
import { MysqlDriver } from './mysql.driver';

jest.mock('mysql2/promise');

const mockExecute = jest.fn();
const mockQuery = jest.fn();
const mockEnd = jest.fn();

describe('MysqlDriver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mysql.createConnection as jest.Mock).mockResolvedValue({
      execute: mockExecute,
      query: mockQuery,
      end: mockEnd,
    });
  });

  const credentials = {
    DATABASE_URL: 'mysql://orbit:pass@resource-1:3306/orbit',
  };

  it('lists databases', async () => {
    const driver = new MysqlDriver(credentials);
    await driver.connect();

    mockExecute.mockResolvedValue([
      [{ Database: 'orbit' }, { Database: 'mysql' }],
      [],
    ]);

    const result = await driver.listDatabases();

    expect(result).toEqual(['orbit', 'mysql']);
  });

  it('lists tables', async () => {
    const driver = new MysqlDriver(credentials);
    await driver.connect();

    mockExecute
      .mockResolvedValueOnce([[{ db: 'orbit' }], []])
      .mockResolvedValueOnce([
        [{ TABLE_NAME: 'users' }, { TABLE_NAME: 'orders' }],
        [],
      ]);

    const result = await driver.listTables();

    expect(result).toEqual([
      { name: 'users', type: 'table', schema: 'orbit' },
      { name: 'orders', type: 'table', schema: 'orbit' },
    ]);
  });

  it('describes a table', async () => {
    const driver = new MysqlDriver(credentials);
    await driver.connect();

    mockExecute
      .mockResolvedValueOnce([[{ db: 'orbit' }], []])
      .mockResolvedValueOnce([
        [
          {
            COLUMN_NAME: 'id',
            DATA_TYPE: 'int',
            IS_NULLABLE: 'NO',
            COLUMN_DEFAULT: null,
            COLUMN_KEY: 'PRI',
          },
          {
            COLUMN_NAME: 'email',
            DATA_TYPE: 'varchar',
            IS_NULLABLE: 'NO',
            COLUMN_DEFAULT: null,
            COLUMN_KEY: '',
          },
        ],
        [],
      ]);

    const result = await driver.describeTable('users');

    expect(result.columns).toEqual([
      {
        name: 'id',
        type: 'int',
        nullable: false,
        default: null,
        primaryKey: true,
      },
      {
        name: 'email',
        type: 'varchar',
        nullable: false,
        default: null,
        primaryKey: false,
      },
    ]);
  });

  it('paginates table data', async () => {
    const driver = new MysqlDriver(credentials);
    await driver.connect();

    mockExecute.mockReset();
    mockExecute.mockImplementation(async (query: string) => {
      if (query.includes('SELECT DATABASE()')) {
        return [[{ db: 'orbit' }], []];
      }
      if (query.includes('information_schema.columns')) {
        return [
          [
            {
              COLUMN_NAME: 'id',
              DATA_TYPE: 'int',
              IS_NULLABLE: 'NO',
              COLUMN_DEFAULT: null,
              COLUMN_KEY: 'PRI',
            },
            {
              COLUMN_NAME: 'email',
              DATA_TYPE: 'varchar',
              IS_NULLABLE: 'NO',
              COLUMN_DEFAULT: null,
              COLUMN_KEY: '',
            },
          ],
          [],
        ];
      }
      if (query.includes('COUNT(*)')) {
        return [[{ total: 250 }], []];
      }
      return [[{ id: 1, email: 'a@example.com' }], []];
    });

    const result = await driver.paginateData('users', { page: 1, limit: 50 });

    expect(result.meta.total).toBe(250);
    expect(result.rows).toEqual([{ id: 1, email: 'a@example.com' }]);
  });

  it('runs a query inside a read-only transaction', async () => {
    const driver = new MysqlDriver(credentials);
    await driver.connect();

    mockQuery.mockResolvedValue([[], []]);
    mockExecute.mockResolvedValue([[{ id: 1 }], [{ name: 'id' }]]);

    const result = await driver.execute('SELECT id FROM users');

    expect(mockQuery.mock.calls).toEqual([
      ['START TRANSACTION READ ONLY'],
      ['ROLLBACK'],
    ]);
    expect(mockExecute).toHaveBeenCalledWith('SELECT id FROM users');
    expect(mockQuery.mock.invocationCallOrder[0]).toBeLessThan(
      mockExecute.mock.invocationCallOrder[0],
    );
    expect(result).toEqual({
      columns: [{ name: 'id' }],
      rows: [{ id: 1 }],
      rowCount: 1,
    });
  });

  it('rolls back and rethrows when the query fails', async () => {
    const driver = new MysqlDriver(credentials);
    await driver.connect();

    mockQuery.mockResolvedValue([[], []]);
    mockExecute.mockRejectedValue(
      new Error('Cannot execute statement in a READ ONLY transaction.'),
    );

    await expect(
      driver.execute('EXPLAIN ANALYZE DELETE a FROM users a JOIN orders b'),
    ).rejects.toThrow('READ ONLY transaction');
    expect(mockQuery).toHaveBeenLastCalledWith('ROLLBACK');
  });

  it('closes the connection', async () => {
    const driver = new MysqlDriver(credentials);
    await driver.connect();
    await driver.close();

    expect(mockEnd).toHaveBeenCalled();
  });
});
