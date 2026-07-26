import { createClient } from 'redis';
import { RedisDriver } from './redis.driver';

jest.mock('redis');

const mockSendCommand = jest.fn();
const mockDisconnect = jest.fn();
const mockInfo = jest.fn();

describe('RedisDriver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockReturnValue({
      connect: jest.fn().mockResolvedValue(undefined),
      sendCommand: mockSendCommand,
      disconnect: mockDisconnect,
      info: mockInfo,
    });
  });

  const credentials = {
    REDIS_URL: 'redis://:pass@resource-1:6379',
  };

  it('lists databases', async () => {
    const driver = new RedisDriver(credentials);
    await driver.connect();

    mockInfo.mockResolvedValue(
      '# Keyspace\r\ndb0:keys=1,expires=0,avg_ttl=0\r\ndb1:keys=2,expires=0,avg_ttl=0',
    );

    const result = await driver.listDatabases();

    expect(result).toEqual(['db0', 'db1']);
  });

  it('lists tables grouped by key prefix', async () => {
    const driver = new RedisDriver(credentials);
    await driver.connect();

    mockSendCommand.mockResolvedValue(['0', ['user:1', 'user:2', 'order:1']]);

    const result = await driver.listTables();

    expect(result).toContainEqual({
      name: 'user:*',
      type: 'key',
      schema: '2 keys',
    });
    expect(result).toContainEqual({
      name: 'order:*',
      type: 'key',
      schema: '1 keys',
    });
  });

  it('describes a table', async () => {
    const driver = new RedisDriver(credentials);
    await driver.connect();

    mockSendCommand.mockResolvedValue('string');

    const result = await driver.describeTable('user:*');

    expect(result.columns).toEqual([
      { name: 'key', type: 'string' },
      { name: 'type', type: 'string' },
      { name: 'value', type: 'string' },
    ]);
  });

  it('paginates keys', async () => {
    const driver = new RedisDriver(credentials);
    await driver.connect();

    mockSendCommand
      .mockResolvedValueOnce(['0', ['user:1', 'user:2']])
      .mockResolvedValueOnce('string')
      .mockResolvedValueOnce('alice')
      .mockResolvedValueOnce('string')
      .mockResolvedValueOnce('bob');

    const result = await driver.paginateData('user:*', { page: 1, limit: 50 });

    expect(result.rows).toEqual([
      { key: 'user:1', type: 'string', value: 'alice' },
      { key: 'user:2', type: 'string', value: 'bob' },
    ]);
    expect(result.meta.total).toBe(2);
  });

  it('executes a command', async () => {
    const driver = new RedisDriver(credentials);
    await driver.connect();

    mockSendCommand.mockResolvedValue('bar');

    const result = await driver.execute('GET foo');

    expect(mockSendCommand).toHaveBeenCalledWith(['GET', 'foo']);
    expect(result.rows).toEqual([{ result: 'bar' }]);
  });

  it('closes the connection', async () => {
    const driver = new RedisDriver(credentials);
    await driver.connect();
    await driver.close();

    expect(mockDisconnect).toHaveBeenCalled();
  });
});
