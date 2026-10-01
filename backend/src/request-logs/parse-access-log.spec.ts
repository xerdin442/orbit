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
      path: '/api/users',
      query: 'page=2',
      hostname: 'app.example.com',
      statusCode: 200,
      durationMs: 2,
      timestamp: new Date(1756334364682),
    });
  });

  it('splits the path and query string', () => {
    const line = JSON.stringify({
      logger: 'http.log.access',
      request: {
        method: 'GET',
        host: 'app.example.com',
        uri: '/orders?status=open&page=2',
      },
      status: 200,
      duration: 0.1,
    });

    const parsed = parseAccessLogLine(line);
    expect(parsed?.path).toBe('/orders');
    expect(parsed?.query).toBe('status=open&page=2');
  });

  it("strips Next's _rsc cache-buster so RSC hits collapse onto the plain path", () => {
    const line = JSON.stringify({
      logger: 'http.log.access',
      request: {
        method: 'GET',
        host: 'app.example.com',
        uri: '/dashboard?tab=usage&_rsc=9f3ac1',
        headers: { RSC: ['1'] },
      },
      status: 200,
      duration: 0.1,
    });

    const parsed = parseAccessLogLine(line);
    expect(parsed?.path).toBe('/dashboard');
    expect(parsed?.query).toBe('tab=usage');
  });

  it('leaves query undefined when there is none', () => {
    const line = JSON.stringify({
      logger: 'http.log.access',
      request: { method: 'GET', host: 'app.example.com', uri: '/dashboard' },
      status: 200,
      duration: 0.1,
    });

    const parsed = parseAccessLogLine(line);
    expect(parsed?.path).toBe('/dashboard');
    expect(parsed?.query).toBeUndefined();
  });

  it('caps an overlong query string', () => {
    const line = JSON.stringify({
      logger: 'http.log.access',
      request: {
        method: 'GET',
        host: 'app.example.com',
        uri: `/search?q=${'x'.repeat(5000)}`,
      },
      status: 200,
      duration: 0.1,
    });

    expect(parseAccessLogLine(line)?.query).toHaveLength(1024);
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

    expect(parseAccessLogLine(line)?.path).toBe('/dashboard');
  });

  it('drops CORS preflight requests', () => {
    const line = JSON.stringify({
      logger: 'http.log.access',
      request: {
        method: 'OPTIONS',
        host: 'api.example.com',
        uri: '/orders',
        headers: {
          Origin: ['https://app.example.com'],
          'Access-Control-Request-Method': ['POST'],
        },
      },
      status: 204,
      duration: 0.001,
    });

    expect(parseAccessLogLine(line)).toBeNull();
  });

  it('keeps a genuine OPTIONS call with no preflight header', () => {
    const line = JSON.stringify({
      logger: 'http.log.access',
      request: {
        method: 'OPTIONS',
        host: 'api.example.com',
        uri: '/orders',
        headers: {
          'User-Agent': ['Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'],
        },
      },
      status: 200,
      duration: 0.001,
    });

    expect(parseAccessLogLine(line)?.path).toBe('/orders');
  });

  it('drops speculative prefetches', () => {
    const headerSets = [
      { 'Sec-Purpose': ['prefetch;prerender'] },
      { Purpose: ['prefetch'] },
      { 'X-Moz': ['prefetch'] },
      // Next.js App Router prefetches every in-viewport <Link>
      { 'Next-Router-Prefetch': ['1'], RSC: ['1'] },
    ];

    for (const headers of headerSets) {
      const line = JSON.stringify({
        logger: 'http.log.access',
        request: {
          method: 'GET',
          host: 'app.example.com',
          uri: '/login?_rsc=abc123',
          headers,
        },
        status: 200,
        duration: 0.01,
      });
      expect(parseAccessLogLine(line)).toBeNull();
    }
  });

  it('keeps the RSC fetch behind a real navigation (no prefetch header)', () => {
    const line = JSON.stringify({
      logger: 'http.log.access',
      request: {
        method: 'GET',
        host: 'app.example.com',
        uri: '/login?_rsc=abc123',
        headers: { RSC: ['1'] },
      },
      status: 200,
      duration: 0.01,
    });

    const parsed = parseAccessLogLine(line);
    expect(parsed?.path).toBe('/login');
    expect(parsed?.query).toBeUndefined();
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

  it('drops requests from scripted HTTP clients regardless of path', () => {
    const agents = [
      'python-httpx/0.28.1',
      'python-requests/2.31.0',
      'curl/8.0.1',
      'Wget/1.21.3',
      'Go-http-client/1.1',
      'nuclei',
      'zgrab/0.x',
      'masscan/1.3',
      'Mozilla/5.0 CensysInspect/1.1',
    ];

    for (const agent of agents) {
      const line = JSON.stringify({
        logger: 'http.log.access',
        request: {
          method: 'GET',
          host: 'app.example.com',
          uri: '/',
          headers: { 'User-Agent': [agent] },
        },
        status: 200,
        duration: 0.01,
      });
      expect(parseAccessLogLine(line)).toBeNull();
    }
  });

  it('drops a GET/HEAD Server Action probe even with a real browser UA', () => {
    for (const method of ['GET', 'HEAD']) {
      const line = JSON.stringify({
        logger: 'http.log.access',
        request: {
          method,
          host: 'app.example.com',
          uri: '/administrator/phpinfo.php',
          headers: {
            'User-Agent': [
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
            ],
            'Next-Action': ['x'],
          },
        },
        status: 404,
        duration: 0.003,
      });
      expect(parseAccessLogLine(line)).toBeNull();
    }
  });

  it('keeps a genuine POST Server Action call', () => {
    const line = JSON.stringify({
      logger: 'http.log.access',
      request: {
        method: 'POST',
        host: 'app.example.com',
        uri: '/dashboard',
        headers: {
          'User-Agent': ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)'],
          'Next-Action': ['7f1a2b3c4d5e6f7081920a1b2c3d4e5f60718293'],
        },
      },
      status: 200,
      duration: 0.02,
    });

    expect(parseAccessLogLine(line)?.path).toBe('/dashboard');
  });

  it('keeps requests from real browsers', () => {
    const line = JSON.stringify({
      logger: 'http.log.access',
      request: {
        method: 'GET',
        host: 'app.example.com',
        uri: '/',
        headers: {
          'User-Agent': [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0',
          ],
        },
      },
      status: 200,
      duration: 0.1,
    });

    expect(parseAccessLogLine(line)?.path).toBe('/');
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

  it('flags scanner probes for hidden files', () => {
    expect(isNoiseRequest('/.env')).toBe(true);
    expect(isNoiseRequest('/api/.env')).toBe(true);
    expect(isNoiseRequest('/.env.production')).toBe(true);
    expect(isNoiseRequest('/../.env')).toBe(true);
    expect(isNoiseRequest('/%2e%2e%2f%2eenv')).toBe(true);
    expect(isNoiseRequest('/.git/HEAD')).toBe(true);
    expect(isNoiseRequest('/.git/config')).toBe(true);
    expect(isNoiseRequest('/.vscode/sftp.json')).toBe(true);
    expect(isNoiseRequest('/.DS_Store')).toBe(true);
    expect(isNoiseRequest('/.well-known/pki-validation/ABC123.txt')).toBe(true);
  });

  it('does not flag application routes', () => {
    expect(isNoiseRequest('/')).toBe(false);
    expect(isNoiseRequest('/environment')).toBe(false);
    expect(isNoiseRequest('/.environment')).toBe(false);
    expect(isNoiseRequest('/gitlab')).toBe(false);
    expect(isNoiseRequest('/%E0%A4%A')).toBe(false);
    expect(isNoiseRequest('/login')).toBe(false);
    expect(isNoiseRequest('/api/users')).toBe(false);
    expect(isNoiseRequest('/api/users.json')).toBe(false);
    expect(isNoiseRequest('/sitemap.xml')).toBe(false);
    expect(isNoiseRequest('/robots.txt')).toBe(false);
    expect(isNoiseRequest('/reports/2024.q1')).toBe(false);
  });
});
