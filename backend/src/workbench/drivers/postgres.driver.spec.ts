import { Client } from 'pg';
import { PostgresDriver } from './postgres.driver';

jest.mock('pg');

const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockQuery = jest.fn();
const mockEnd = jest.fn();

describe('PostgresDriver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Client as jest.Mock).mockImplementation(() => ({
      connect: mockConnect,
      query: mockQuery,
      end: mockEnd,
    }));
  });

  const credentials = {
    DATABASE_URL: 'postgres://orbit:pass@resource-1:5432/orbit',
  };

  it('lists databases', async () => {
    const driver = new PostgresDriver(credentials);
    await driver.connect();

    mockQuery.mockResolvedValue({
      rows: [{ datname: 'orbit' }, { datname: 'postgres' }],
      fields: [],
    });

    const result = await driver.listDatabases();

    expect(result).toEqual(['orbit', 'postgres']);
  });

  it('lists tables', async () => {
    const driver = new PostgresDriver(credentials);
    await driver.connect();

    mockQuery.mockResolvedValue({
      rows: [
        { table_schema: 'public', table_name: 'users' },
        { table_schema: 'public', table_name: 'orders' },
      ],
      fields: [],
    });

    const result = await driver.listTables();

    expect(result).toEqual([
      { name: 'users', type: 'table', schema: 'public' },
      { name: 'orders', type: 'table', schema: 'public' },
    ]);
  });

  it('describes a table', async () => {
    const driver = new PostgresDriver(credentials);
    await driver.connect();

    mockQuery.mockResolvedValue({
      rows: [
        {
          column_name: 'id',
          data_type: 'integer',
          is_nullable: 'NO',
          column_default: null,
        },
        {
          column_name: 'email',
          data_type: 'character varying',
          is_nullable: 'NO',
          column_default: null,
        },
      ],
      fields: [],
    });

    const result = await driver.describeTable('users');

    expect(result.columns).toEqual([
      { name: 'id', type: 'integer', nullable: false, default: null },
      {
        name: 'email',
        type: 'character varying',
        nullable: false,
        default: null,
      },
    ]);
  });

  it('paginates table data', async () => {
    const driver = new PostgresDriver(credentials);
    await driver.connect();

    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            column_name: 'id',
            data_type: 'integer',
            is_nullable: 'NO',
            column_default: null,
          },
          {
            column_name: 'email',
            data_type: 'character varying',
            is_nullable: 'NO',
            column_default: null,
          },
        ],
        fields: [],
      })
      .mockResolvedValueOnce({
        rows: [{ total: 250 }],
        fields: [],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 1, email: 'a@example.com' }],
        fields: [{ name: 'id' }, { name: 'email' }],
      });

    const result = await driver.paginateData('users', { page: 1, limit: 100 });

    expect(result.meta).toMatchObject({
      total: 250,
      page: 1,
      limit: 100,
      totalPages: 3,
      hasNextPage: true,
      hasPrevPage: false,
    });
    expect(result.rows).toEqual([{ id: 1, email: 'a@example.com' }]);
  });

  it('closes the connection', async () => {
    const driver = new PostgresDriver(credentials);
    await driver.connect();
    await driver.close();

    expect(mockEnd).toHaveBeenCalled();
  });
});
