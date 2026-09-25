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

  it('drops WordPress REST and phpinfo probes made against the site root', () => {
    const line = (uri: string) =>
      JSON.stringify({
        logger: 'http.log.access',
        ts: 1756334364.682,
        request: { method: 'POST', host: 'app.example.com', uri },
        status: 404,
        duration: 0.01,
      });

    expect(parseAccessLogLine(line('/?rest_route=%2Fbatch%2Fv1'))).toBeNull();
    expect(parseAccessLogLine(line('/?phpinfo=1'))).toBeNull();
    expect(parseAccessLogLine(line('/?page=2'))).not.toBeNull();
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
      'Mozilla/5.0 (l9scan/2.0.230323e24373e28323e223; +https://leakix.net)',
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

describe('clientIp extraction', () => {
  it('prefers client_ip over remote_ip', () => {
    const line = JSON.stringify({
      logger: 'http.log.access',
      request: {
        method: 'GET',
        host: 'app.example.com',
        uri: '/',
        client_ip: '203.0.113.5',
        remote_ip: '10.0.0.1',
      },
      status: 200,
      duration: 0.01,
    });

    expect(parseAccessLogLine(line)?.clientIp).toBe('203.0.113.5');
  });

  it('falls back to remote_ip when client_ip is absent', () => {
    const line = JSON.stringify({
      logger: 'http.log.access',
      request: {
        method: 'GET',
        host: 'app.example.com',
        uri: '/',
        remote_ip: '10.0.0.1',
      },
      status: 200,
      duration: 0.01,
    });

    expect(parseAccessLogLine(line)?.clientIp).toBe('10.0.0.1');
  });

  it('returns undefined for an unparseable or non-access-log line', () => {
    expect(parseAccessLogLine('not json')?.clientIp).toBeUndefined();
    expect(
      parseAccessLogLine(JSON.stringify({ logger: 'http.log.error' }))
        ?.clientIp,
    ).toBeUndefined();
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

  it('flags WordPress scanner sweeps', () => {
    expect(isNoiseRequest('/wp-json/batch/v1')).toBe(true);
    expect(isNoiseRequest('/wp-admin/setup-config.php')).toBe(true);
    expect(isNoiseRequest('/wp-content/uploads/x.php')).toBe(true);
    expect(isNoiseRequest('/wp-includes/wlwmanifest.xml')).toBe(true);
    expect(isNoiseRequest('/wp-login.php')).toBe(true);
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

  it('flags cloud credential-harvesting probes', () => {
    expect(isNoiseRequest('/.aws/credentials')).toBe(true);
    expect(isNoiseRequest('/.aws/config')).toBe(true);
    expect(isNoiseRequest('/.docker/config.json')).toBe(true);
    expect(isNoiseRequest('/.gcp/credentials.json')).toBe(true);
    expect(isNoiseRequest('/.gcp/service-account.json')).toBe(true);
    expect(isNoiseRequest('/gcp-credentials.json')).toBe(true);
    expect(isNoiseRequest('/gcp-service-account.json')).toBe(true);
    expect(isNoiseRequest('/google-credentials.json')).toBe(true);
    expect(isNoiseRequest('/google-cloud-key.json')).toBe(true);
    expect(isNoiseRequest('/firebase-adminsdk.json')).toBe(true);
    expect(isNoiseRequest('/firebase-credentials.json')).toBe(true);
    expect(isNoiseRequest('/service-account.json')).toBe(true);
    expect(isNoiseRequest('/app/service-account.json')).toBe(true);
    expect(
      isNoiseRequest(
        '/root/.config/gcloud/application_default_credentials.json',
      ),
    ).toBe(true);
    expect(isNoiseRequest('/root/.config/gcloud/credentials.db')).toBe(true);
    expect(
      isNoiseRequest(
        '/home/node/.config/gcloud/application_default_credentials.json',
      ),
    ).toBe(true);
  });

  it('flags the wlwmanifest.xml WordPress-enumeration probe, not real XML', () => {
    expect(isNoiseRequest('/wp-includes/wlwmanifest.xml')).toBe(true);
    expect(isNoiseRequest('/web/wp-includes/wlwmanifest.xml')).toBe(true);
    expect(isNoiseRequest('/2019/wp-includes/wlwmanifest.xml')).toBe(true);
    expect(isNoiseRequest('/sitemap.xml')).toBe(false);
    expect(isNoiseRequest('/feed.xml')).toBe(false);
  });

  it('flags any dot-file or dot-directory probe', () => {
    expect(isNoiseRequest('/.svn/entries')).toBe(true);
    expect(isNoiseRequest('/.svn/wc.db')).toBe(true);
    expect(isNoiseRequest('/.ssh/id_rsa')).toBe(true);
    expect(isNoiseRequest('/.kube/config')).toBe(true);
    expect(isNoiseRequest('/.terraform/terraform.tfstate')).toBe(true);
    expect(isNoiseRequest('/.github/workflows/ci.yml')).toBe(true);
    expect(isNoiseRequest('/.idea/webServers.xml')).toBe(true);
    expect(isNoiseRequest('/.claude/settings.json')).toBe(true);
    expect(isNoiseRequest('/.anthropic/config.json')).toBe(true);
    expect(isNoiseRequest('/.netrc')).toBe(true);
    expect(isNoiseRequest('/.env-sample')).toBe(true);
    expect(isNoiseRequest('/.env~')).toBe(true);
    expect(isNoiseRequest('/.environment')).toBe(true);
    expect(isNoiseRequest('/.wp-config.php.swp')).toBe(true);
  });

  it('flags server-side script and config/secret file probes', () => {
    expect(isNoiseRequest('/xmlrpc.php')).toBe(true);
    expect(isNoiseRequest('/phpinfo.php')).toBe(true);
    expect(isNoiseRequest('/admin/phpinfo.php')).toBe(true);
    expect(isNoiseRequest('/config/database.yml')).toBe(true);
    expect(isNoiseRequest('/docker-compose.yml')).toBe(true);
    expect(isNoiseRequest('/serverless.yaml')).toBe(true);
    expect(isNoiseRequest('/netlify.toml')).toBe(true);
    expect(isNoiseRequest('/settings.py')).toBe(true);
    expect(isNoiseRequest('/config/environment.rb')).toBe(true);
    expect(isNoiseRequest('/database.sql')).toBe(true);
    expect(isNoiseRequest('/db.bak')).toBe(true);
    expect(isNoiseRequest('/terraform.tfstate')).toBe(true);
    expect(isNoiseRequest('/terraform.tfstate.backup')).toBe(true);
    expect(isNoiseRequest('/terraform.tfvars')).toBe(true);
    expect(isNoiseRequest('/privkey.pem')).toBe(true);
    expect(isNoiseRequest('/s3.key')).toBe(true);
    expect(isNoiseRequest('/composer.lock')).toBe(true);
    expect(isNoiseRequest('/stripe/webhook_secret.env')).toBe(true);
  });

  it('flags secret-bearing JSON and credential file names', () => {
    expect(isNoiseRequest('/aws.json')).toBe(true);
    expect(isNoiseRequest('/config/aws.json')).toBe(true);
    expect(isNoiseRequest('/aws-credentials.json')).toBe(true);
    expect(isNoiseRequest('/stripe.json')).toBe(true);
    expect(isNoiseRequest('/plugins/payments/stripe.json')).toBe(true);
    expect(isNoiseRequest('/credentials.json')).toBe(true);
    expect(isNoiseRequest('/client_secret.json')).toBe(true);
    expect(isNoiseRequest('/service-account-credentials.json')).toBe(true);
    expect(isNoiseRequest('/appsettings.Production.json')).toBe(true);
    expect(isNoiseRequest('/amplify/team-provider-info.json')).toBe(true);
    expect(isNoiseRequest('/claude_desktop_config.json')).toBe(true);
    expect(isNoiseRequest('/sftp.json')).toBe(true);
    expect(isNoiseRequest('/terraform/terraform.tfvars.json')).toBe(true);
    expect(isNoiseRequest('/aws/s3/credentials')).toBe(true);
    expect(isNoiseRequest('/s3/credentials')).toBe(true);
    expect(isNoiseRequest('/id_rsa')).toBe(true);
    expect(isNoiseRequest('/Dockerfile')).toBe(true);
    expect(isNoiseRequest('/phpinfo')).toBe(true);
    expect(isNoiseRequest('/nginx-status')).toBe(true);
  });

  it('flags robots.txt crawler hits', () => {
    expect(isNoiseRequest('/robots.txt')).toBe(true);
    expect(isNoiseRequest('/blog/robots.txt')).toBe(true);
    expect(isNoiseRequest('/ROBOTS.TXT')).toBe(true);
    expect(isNoiseRequest('/robots.txt.bak')).toBe(true);
    expect(isNoiseRequest('/my-robots.txt')).toBe(false);
  });

  it('flags framework debug endpoints and CMS subdirectory probes', () => {
    expect(isNoiseRequest('/_ignition/execute-solution')).toBe(true);
    expect(isNoiseRequest('/_profiler/phpinfo')).toBe(true);
    expect(isNoiseRequest('/symfony/_profiler/phpinfo')).toBe(true);
    expect(isNoiseRequest('/cgi-bin/printenv.pl')).toBe(true);
    expect(isNoiseRequest('/_darcs/prefs/binaries')).toBe(true);
    expect(isNoiseRequest('/wordpress/')).toBe(true);
  });

  it('does not flag application routes', () => {
    expect(isNoiseRequest('/')).toBe(false);
    expect(isNoiseRequest('/environment')).toBe(false);
    expect(isNoiseRequest('/api/stripe/webhook')).toBe(false);
    expect(isNoiseRequest('/api/credentials')).toBe(false);
    expect(isNoiseRequest('/settings')).toBe(false);
    expect(isNoiseRequest('/settings.json')).toBe(false);
    expect(isNoiseRequest('/blog/')).toBe(false);
    expect(isNoiseRequest('/feed')).toBe(false);
    expect(isNoiseRequest('/gitlab')).toBe(false);
    expect(isNoiseRequest('/%E0%A4%A')).toBe(false);
    expect(isNoiseRequest('/login')).toBe(false);
    expect(isNoiseRequest('/api/users')).toBe(false);
    expect(isNoiseRequest('/api/users.json')).toBe(false);
    expect(isNoiseRequest('/sitemap.xml')).toBe(false);
    expect(isNoiseRequest('/reports/2024.q1')).toBe(false);
    expect(isNoiseRequest('/config.json')).toBe(false);
    expect(isNoiseRequest('/api/config')).toBe(false);
    expect(isNoiseRequest('/config/gcp.json')).toBe(false);
  });
});
