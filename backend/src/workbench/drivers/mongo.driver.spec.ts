import { MongoClient } from 'mongodb';
import { MongoDriver } from './mongo.driver';

jest.mock('mongodb');

describe('MongoDriver', () => {
  let mockCollection: any;
  let mockDb: any;
  let mockClient: any;
  let mockToArray: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockToArray = jest.fn();
    mockCollection = {
      find: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        toArray: mockToArray,
      }),
      findOne: jest.fn(),
      aggregate: jest.fn().mockReturnValue({ toArray: mockToArray }),
      countDocuments: jest.fn(),
      indexes: jest.fn(),
    };

    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection),
      listCollections: jest.fn().mockReturnValue({ toArray: mockToArray }),
      admin: jest.fn().mockReturnValue({
        listDatabases: jest.fn(),
      }),
    };

    mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      db: jest.fn().mockReturnValue(mockDb),
      close: jest.fn(),
    };

    (MongoClient as jest.Mock).mockImplementation(() => mockClient);
  });

  const credentials = {
    MONGO_URI: 'mongodb://orbit:pass@resource-1:27017/orbit',
  };

  it('lists databases', async () => {
    const driver = new MongoDriver(credentials);
    await driver.connect();

    mockDb.admin().listDatabases.mockResolvedValue({
      databases: [{ name: 'orbit' }, { name: 'admin' }],
    });

    const result = await driver.listDatabases();

    expect(result).toEqual(['orbit', 'admin']);
  });

  it('lists collections', async () => {
    const driver = new MongoDriver(credentials);
    await driver.connect();

    mockToArray.mockResolvedValue([{ name: 'users' }, { name: 'orders' }]);

    const result = await driver.listTables();

    expect(result).toEqual([
      { name: 'users', type: 'collection', schema: '' },
      { name: 'orders', type: 'collection', schema: '' },
    ]);
  });

  it('describes a collection from sample document', async () => {
    const driver = new MongoDriver(credentials);
    await driver.connect();

    mockCollection.findOne.mockResolvedValue({
      _id: '1',
      email: 'a@example.com',
      age: 30,
    });
    mockCollection.indexes.mockResolvedValue([
      { key: { _id: 1 }, name: '_id_' },
    ]);

    const result = await driver.describeTable('users');

    expect(result.columns).toContainEqual({
      name: '_id',
      type: 'string',
      primaryKey: true,
    });
    expect(result.columns).toContainEqual({
      name: 'email',
      type: 'string',
      primaryKey: false,
    });
    expect(result.columns).toContainEqual({
      name: 'age',
      type: 'number',
      primaryKey: false,
    });
  });

  it('paginates collection data', async () => {
    const driver = new MongoDriver(credentials);
    await driver.connect();

    mockToArray.mockResolvedValue([{ _id: '1', email: 'a@example.com' }]);
    mockCollection.countDocuments.mockResolvedValue(250);
    mockCollection.findOne.mockResolvedValue({
      _id: '1',
      email: 'a@example.com',
    });
    mockCollection.indexes.mockResolvedValue([
      { key: { _id: 1 }, name: '_id_' },
    ]);

    const result = await driver.paginateData('users', { page: 1, limit: 100 });

    expect(result.meta.total).toBe(250);
    expect(result.rows).toEqual([{ _id: '1', email: 'a@example.com' }]);
  });

  it('executes a find command', async () => {
    const driver = new MongoDriver(credentials);
    await driver.connect();

    mockToArray.mockResolvedValue([{ _id: '1', email: 'a@example.com' }]);

    const result = await driver.execute(
      JSON.stringify({ collection: 'users', operation: 'find', filter: {} }),
    );

    expect(result.rowCount).toBe(1);
    expect(result.rows).toEqual([{ _id: '1', email: 'a@example.com' }]);
  });

  it('closes the connection', async () => {
    const driver = new MongoDriver(credentials);
    await driver.connect();
    await driver.close();

    expect(mockClient.close).toHaveBeenCalled();
  });
});
