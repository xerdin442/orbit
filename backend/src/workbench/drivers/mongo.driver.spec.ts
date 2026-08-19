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
      estimatedDocumentCount: jest.fn(),
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

    (MongoClient as unknown as jest.Mock).mockImplementation(() => mockClient);
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

  it('lists collections with document counts', async () => {
    const driver = new MongoDriver(credentials);
    await driver.connect();

    mockToArray.mockResolvedValue([{ name: 'users' }, { name: 'orders' }]);
    mockCollection.estimatedDocumentCount
      .mockResolvedValueOnce(150)
      .mockResolvedValueOnce(42);

    const result = await driver.listTables();

    expect(result).toEqual([
      {
        name: 'users',
        type: 'collection',
        schema: '',
        documentCount: 150,
      },
      {
        name: 'orders',
        type: 'collection',
        schema: '',
        documentCount: 42,
      },
    ]);
  });

  it('describes a flat collection', async () => {
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

    expect(result.columns).toEqual([
      { name: '_id', type: 'string', primaryKey: true },
      { name: 'email', type: 'string', primaryKey: false },
      { name: 'age', type: 'number', primaryKey: false },
    ]);
  });

  it('describes a collection with nested documents and arrays', async () => {
    const driver = new MongoDriver(credentials);
    await driver.connect();

    mockCollection.findOne.mockResolvedValue({
      _id: '1',
      name: 'Alice',
      address: { street: '123 Main', city: 'NYC' },
      tags: ['admin', 'user'],
    });
    mockCollection.indexes.mockResolvedValue([
      { key: { _id: 1 }, name: '_id_' },
    ]);

    const result = await driver.describeTable('users');

    expect(result.columns).toEqual([
      { name: '_id', type: 'string', primaryKey: true },
      { name: 'name', type: 'string', primaryKey: false },
      {
        name: 'address',
        type: 'object',
        primaryKey: false,
        fields: [
          { name: 'street', type: 'string' },
          { name: 'city', type: 'string' },
        ],
      },
      {
        name: 'tags',
        type: 'array',
        primaryKey: false,
        arrayOf: { name: '', type: 'string' },
      },
    ]);
  });

  it('describes an empty collection', async () => {
    const driver = new MongoDriver(credentials);
    await driver.connect();

    mockCollection.findOne.mockResolvedValue(null);
    mockCollection.indexes.mockResolvedValue([]);

    const result = await driver.describeTable('empty');

    expect(result.columns).toEqual([
      { name: '_id', type: 'objectId', primaryKey: true },
    ]);
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

    const result = await driver.paginateData('users', { page: 1, limit: 50 });

    expect(result.meta.total).toBe(250);
    expect(result.rows).toEqual([{ _id: '1', email: 'a@example.com' }]);
  });

  it('executes a find command', async () => {
    const driver = new MongoDriver(credentials);
    await driver.connect();

    mockToArray.mockResolvedValue([{ _id: '1', email: 'a@example.com' }]);

    const result = await driver.execute('db.users.find({})');

    expect(mockDb.collection).toHaveBeenCalledWith('users');
    expect(mockCollection.find).toHaveBeenCalledWith({});
    expect(result.rowCount).toBe(1);
    expect(result.rows).toEqual([{ _id: '1', email: 'a@example.com' }]);
  });

  it('executes a find command with a filter', async () => {
    const driver = new MongoDriver(credentials);
    await driver.connect();

    mockToArray.mockResolvedValue([{ _id: '1', age: 30 }]);

    await driver.execute('db.users.find({ age: { $gt: 21 } })');

    expect(mockCollection.find).toHaveBeenCalledWith({ age: { $gt: 21 } });
  });

  it('executes a findOne command', async () => {
    const driver = new MongoDriver(credentials);
    await driver.connect();

    mockCollection.findOne.mockResolvedValue({ _id: '1' });

    const result = await driver.execute(
      'db.users.findOne({ email: "a@example.com" })',
    );

    expect(mockCollection.findOne).toHaveBeenCalledWith({
      email: 'a@example.com',
    });
    expect(result.rows).toEqual([{ _id: '1' }]);
  });

  it('executes an aggregate pipeline', async () => {
    const driver = new MongoDriver(credentials);
    await driver.connect();

    mockToArray.mockResolvedValue([{ _id: '1', total: 42 }]);

    await driver.execute(
      'db.orders.aggregate([{ $match: { status: "paid" } }, { $group: { _id: "$status", total: { $sum: "$amount" } } }])',
    );

    expect(mockCollection.aggregate).toHaveBeenCalledWith([
      { $match: { status: 'paid' } },
      { $group: { _id: '$status', total: { $sum: '$amount' } } },
    ]);
  });

  it('executes a distinct command', async () => {
    const driver = new MongoDriver(credentials);
    await driver.connect();

    mockCollection.distinct = jest.fn().mockResolvedValue(['NY', 'CA']);

    const result = await driver.execute('db.users.distinct("state", {})');

    expect(mockCollection.distinct).toHaveBeenCalledWith('state', {});
    expect(result.rows).toEqual(['NY', 'CA']);
  });

  it('executes a countDocuments command', async () => {
    const driver = new MongoDriver(credentials);
    await driver.connect();

    mockCollection.countDocuments.mockResolvedValue(7);

    const result = await driver.execute('db.users.countDocuments({})');

    expect(result.rows).toEqual([7]);
  });

  it('rejects queries that are not in db.<collection>.<method>() shell syntax', async () => {
    const driver = new MongoDriver(credentials);
    await driver.connect();

    await expect(
      driver.execute(JSON.stringify({ operation: 'find', collection: 'x' })),
    ).rejects.toThrow(/Invalid query/);
  });

  it('rejects aggregate pipelines containing $merge', async () => {
    const driver = new MongoDriver(credentials);
    await driver.connect();

    await expect(
      driver.execute('db.orders.aggregate([{ $merge: { into: "other" } }])'),
    ).rejects.toThrow(/\$merge/);

    expect(mockCollection.aggregate).not.toHaveBeenCalled();
  });

  it('rejects aggregate pipelines containing $out', async () => {
    const driver = new MongoDriver(credentials);
    await driver.connect();

    await expect(
      driver.execute('db.orders.aggregate([{ $out: "copy" }])'),
    ).rejects.toThrow(/\$out/);
  });

  it('rejects filters using $where', async () => {
    const driver = new MongoDriver(credentials);
    await driver.connect();

    await expect(
      driver.execute('db.users.find({ $where: "this.age > 21" })'),
    ).rejects.toThrow(/\$where/);
  });

  it('rejects pipelines using $function nested in another stage', async () => {
    const driver = new MongoDriver(credentials);
    await driver.connect();

    await expect(
      driver.execute(
        'db.users.aggregate([{ $match: { $expr: { $function: { body: "function() {}", args: [], lang: "js" } } } }])',
      ),
    ).rejects.toThrow(/\$function/);
  });

  it('closes the connection', async () => {
    const driver = new MongoDriver(credentials);
    await driver.connect();
    await driver.close();

    expect(mockClient.close).toHaveBeenCalled();
  });
});
