import { WorkbenchService } from './workbench.service';
import { DbService } from '@src/db/db.service';
import { ResourceType } from '@generated/client';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import {
  PostgresDriver,
  MysqlDriver,
  RedisDriver,
  MongoDriver,
} from './drivers';

jest.mock('./drivers');

const mockDriver = {
  connect: jest.fn(),
  close: jest.fn(),
  listDatabases: jest.fn(),
  listTables: jest.fn(),
  paginateData: jest.fn(),
  execute: jest.fn(),
  describeTable: jest.fn(),
};

describe('WorkbenchService', () => {
  let service: WorkbenchService;
  let db: jest.Mocked<Pick<DbService, 'resource'>>;

  beforeEach(() => {
    jest.clearAllMocks();

    (PostgresDriver as jest.Mock).mockImplementation(() => mockDriver);
    (MysqlDriver as jest.Mock).mockImplementation(() => mockDriver);
    (RedisDriver as jest.Mock).mockImplementation(() => mockDriver);
    (MongoDriver as jest.Mock).mockImplementation(() => mockDriver);

    db = {
      resource: {
        findUnique: jest.fn(),
      },
    } as unknown as jest.Mocked<Pick<DbService, 'resource'>>;

    service = new WorkbenchService(db as unknown as DbService);
  });

  const mockResource = (type: ResourceType) => ({
    id: 'r1',
    type,
    name: 'db',
    credentials: {
      DATABASE_URL: 'protocol://host:1234/db',
    },
    environment: {
      project: {
        ownerId: 'user-1',
      },
    },
  });

  it('returns schema for a resource', async () => {
    db.resource.findUnique = jest
      .fn()
      .mockResolvedValue(mockResource(ResourceType.postgres));
    mockDriver.listDatabases.mockResolvedValue(['db1']);
    mockDriver.listTables.mockResolvedValue([
      { name: 'users', type: 'table' as const },
    ]);

    const result = await service.getSchema('r1', 'user-1');

    expect(result).toEqual({
      databases: [{ name: 'db1', objects: [{ name: 'users', type: 'table' }] }],
    });
    expect(mockDriver.connect).toHaveBeenCalled();
    expect(mockDriver.close).toHaveBeenCalled();
  });

  it('throws NotFoundException when resource does not exist', async () => {
    db.resource.findUnique = jest.fn().mockResolvedValue(null);

    await expect(service.getSchema('r1', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws NotFoundException when user does not own resource', async () => {
    db.resource.findUnique = jest.fn().mockResolvedValue(null);

    await expect(service.getSchema('r1', 'user-2')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('allows read-only SQL queries for postgres', async () => {
    db.resource.findUnique = jest
      .fn()
      .mockResolvedValue(mockResource(ResourceType.postgres));
    mockDriver.execute.mockResolvedValue({
      columns: [],
      rows: [],
      rowCount: 0,
    });

    await service.executeQuery('r1', 'user-1', 'SELECT * FROM users');

    expect(mockDriver.execute).toHaveBeenCalledWith('SELECT * FROM users');
  });

  it('rejects mutating SQL queries for postgres', async () => {
    db.resource.findUnique = jest
      .fn()
      .mockResolvedValue(mockResource(ResourceType.postgres));

    await expect(
      service.executeQuery('r1', 'user-1', 'DELETE FROM users'),
    ).rejects.toThrow(BadRequestException);

    expect(mockDriver.execute).not.toHaveBeenCalled();
  });

  it('wraps malformed query errors as BadRequestException', async () => {
    db.resource.findUnique = jest
      .fn()
      .mockResolvedValue(mockResource(ResourceType.postgres));
    mockDriver.execute.mockRejectedValue(
      new Error('syntax error at or near "FRUM"'),
    );

    await expect(
      service.executeQuery('r1', 'user-1', 'SELECT * FRUM users'),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows read-only Redis commands', async () => {
    db.resource.findUnique = jest
      .fn()
      .mockResolvedValue(mockResource(ResourceType.redis));
    mockDriver.execute.mockResolvedValue({
      columns: [],
      rows: [],
      rowCount: 0,
    });

    await service.executeQuery('r1', 'user-1', 'GET foo');

    expect(mockDriver.execute).toHaveBeenCalledWith('GET foo');
  });

  it('rejects mutating Redis commands', async () => {
    db.resource.findUnique = jest
      .fn()
      .mockResolvedValue(mockResource(ResourceType.redis));

    await expect(
      service.executeQuery('r1', 'user-1', 'DEL foo'),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows read-only Mongo commands', async () => {
    db.resource.findUnique = jest
      .fn()
      .mockResolvedValue(mockResource(ResourceType.mongo));
    mockDriver.execute.mockResolvedValue({
      columns: [],
      rows: [],
      rowCount: 0,
    });

    await service.executeQuery('r1', 'user-1', 'find users');

    expect(mockDriver.execute).toHaveBeenCalledWith('find users');
  });

  it('rejects mutating Mongo commands', async () => {
    db.resource.findUnique = jest
      .fn()
      .mockResolvedValue(mockResource(ResourceType.mongo));

    await expect(
      service.executeQuery('r1', 'user-1', 'insert users'),
    ).rejects.toThrow(BadRequestException);
  });

  it('paginates table data with options', async () => {
    db.resource.findUnique = jest
      .fn()
      .mockResolvedValue(mockResource(ResourceType.postgres));
    mockDriver.paginateData.mockResolvedValue({
      columns: [],
      rows: [],
      meta: {
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });

    await service.getTableData('r1', 'user-1', 'users', { page: 1, limit: 50 });

    expect(mockDriver.paginateData).toHaveBeenCalledWith('users', {
      page: 1,
      limit: 50,
    });
  });
});
