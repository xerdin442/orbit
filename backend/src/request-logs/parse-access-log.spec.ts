import { parseAccessLogLine } from './parse-access-log';

describe('parseAccessLogLine', () => {
  it('parses a well-formed access log line', () => {
    const line = JSON.stringify({
      level: 'info',
      logger: 'http.log.access',
      msg: 'handled request',
      request: {
        method: 'GET',
        host: 'app.example.com',
        uri: '/api/users?page=2',
      },
      status: 200,
      duration: 0.002345,
    });

    expect(parseAccessLogLine(line)).toEqual({
      method: 'GET',
      uri: '/api/users?page=2',
      hostname: 'app.example.com',
      statusCode: 200,
      durationMs: 2,
    });
  });

  it('strips a port suffix from the host', () => {
    const line = JSON.stringify({
      logger: 'http.log.access',
      request: { method: 'POST', host: 'app.example.com:443', uri: '/' },
      status: 500,
      duration: 0.1,
    });

    expect(parseAccessLogLine(line)?.hostname).toBe('app.example.com');
  });

  it('returns null for blank lines', () => {
    expect(parseAccessLogLine('')).toBeNull();
    expect(parseAccessLogLine('   ')).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(parseAccessLogLine('not json')).toBeNull();
  });

  it('returns null for non-access-log entries', () => {
    const line = JSON.stringify({
      logger: 'http.log.error',
      msg: 'something else',
    });

    expect(parseAccessLogLine(line)).toBeNull();
  });

  it('returns null when required fields are missing', () => {
    const line = JSON.stringify({
      logger: 'http.log.access',
      request: { method: 'GET' },
    });

    expect(parseAccessLogLine(line)).toBeNull();
  });
});
