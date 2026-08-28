import { parseAccessLogLine, isNoiseRequest } from './parse-access-log';

describe('parseAccessLogLine', () => {
  it('parses a well-formed access log line', () => {
    const line = JSON.stringify({
      level: 'info',
      logger: 'http.log.access',
      msg: 'handled request',
      ts: 1756334364.682,
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
      uri: '/api/users',
      hostname: 'app.example.com',
      statusCode: 200,
      durationMs: 2,
      timestamp: new Date(1756334364682),
    });
  });

  it('strips the query string from the uri', () => {
    const line = JSON.stringify({
      logger: 'http.log.access',
      request: { method: 'GET', host: 'app.example.com', uri: '/login?_rsc=abc' },
      status: 200,
      duration: 0.1,
    });

    expect(parseAccessLogLine(line)?.uri).toBe('/login');
  });

  it('falls back to an undefined timestamp when ts is absent', () => {
    const line = JSON.stringify({
      logger: 'http.log.access',
      request: { method: 'GET', host: 'app.example.com', uri: '/' },
      status: 200,
      duration: 0.1,
    });

    expect(parseAccessLogLine(line)?.timestamp).toBeUndefined();
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

  it('drops framework internals and static assets', () => {
    const noise = [
      '/_next/static/chunks/main.js',
      '/_next/image?url=%2Flogo.png',
      '/_nuxt/entry.abc123.js',
      '/_astro/index.abc123.css',
      '/_app/version.json',
      '/_vercel/insights/view',
      '/.well-known/appspecific/com.chrome.devtools.json',
      '/dashboard.rsc',
      '/favicon.ico',
      '/site.webmanifest',
      '/fonts/inter.woff2?v=3',
      '/styles/app.css',
    ];

    for (const uri of noise) {
      const line = JSON.stringify({
        logger: 'http.log.access',
        request: { method: 'GET', host: 'app.example.com', uri },
        status: 200,
        duration: 0.01,
      });
      expect(parseAccessLogLine(line)).toBeNull();
    }
  });

  it('keeps real navigations', () => {
    const line = JSON.stringify({
      logger: 'http.log.access',
      request: { method: 'GET', host: 'app.example.com', uri: '/dashboard' },
      status: 200,
      duration: 0.01,
    });

    expect(parseAccessLogLine(line)?.uri).toBe('/dashboard');
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

describe('isNoiseRequest', () => {
  it('flags framework internals', () => {
    expect(isNoiseRequest('/_next/static/chunks/main.js')).toBe(true);
    expect(isNoiseRequest('/_next/image')).toBe(true);
    expect(isNoiseRequest('/_nuxt/entry.js')).toBe(true);
    expect(isNoiseRequest('/_astro/x.css')).toBe(true);
    expect(isNoiseRequest('/_app/version.json')).toBe(true);
    expect(isNoiseRequest('/_vercel/speed-insights/vitals')).toBe(true);
    expect(
      isNoiseRequest('/.well-known/appspecific/com.chrome.devtools.json'),
    ).toBe(true);
  });

  it('flags static asset extensions', () => {
    expect(isNoiseRequest('/favicon.ico')).toBe(true);
    expect(isNoiseRequest('/assets/logo.svg')).toBe(true);
    expect(isNoiseRequest('/f.WOFF2')).toBe(true);
  });

  it('does not flag application routes', () => {
    expect(isNoiseRequest('/')).toBe(false);
    expect(isNoiseRequest('/login')).toBe(false);
    expect(isNoiseRequest('/api/users')).toBe(false);
    expect(isNoiseRequest('/api/users.json')).toBe(false);
    expect(isNoiseRequest('/sitemap.xml')).toBe(false);
    expect(isNoiseRequest('/robots.txt')).toBe(false);
    expect(isNoiseRequest('/reports/2024.q1')).toBe(false);
  });
});
