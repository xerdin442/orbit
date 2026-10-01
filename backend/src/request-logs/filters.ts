export const NOISE_PATH_PREFIXES = [
  '/_next/', // Next.js — chunks, /_next/image, /_next/data, .rsc segments
  '/_nuxt/', // Nuxt 3/4 — hashed bundles, /_nuxt/builds/meta/*.json
  '/_astro/', // Astro — hashed bundles
  '/_app/', // SvelteKit — reserved dir: /_app/immutable/*, /_app/version.json
  '/_vercel/', // @vercel/analytics + @vercel/speed-insights beacons
  '/@vite/', // Vite — hashed bundles, /@vite/client, /@vite/env
  '/.well-known/', // Chrome DevTools probe on every page load, SSL certification challenges
  '/wp', // WordPress scanner sweeps — /wp-json/, /wp-admin/, /wp-content/, /wp-includes/, /wp-login.php
  '/wordpress', // WordPress installed in a subdirectory
  '/_ignition/', // Laravel Ignition RCE probe
  '/_profiler/', // Symfony profiler / phpinfo probes
  '/symfony/',
  '/cgi-bin/',
  '/_darcs/', // darcs VCS metadata
];

export const NOISE_PATH_EXTENSIONS = [
  '.js',
  '.mjs',
  '.cjs',
  '.css',
  '.map',
  '.rsc',
  '.webmanifest',
  '.wasm',
  '.ico',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.avif',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',
];

export const SCANNER_PROBE_EXTENSIONS = [
  '.php',
  '.asp',
  '.aspx',
  '.jsp',
  '.jspx',
  '.cgi',
  '.pl',
  '.rb',
  '.py',
  '.ini',
  '.yml',
  '.yaml',
  '.toml',
  '.conf',
  '.properties',
  '.env',
  '.sql',
  '.bak',
  '.backup',
  '.old',
  '.orig',
  '.swp',
  '.inc',
  '.sdb',
  '.lock',
  '.hcl',
  '.tf',
  '.tfstate',
  '.tfvars',
  '.pem',
  '.key',
  '.secret',
];

export const SCANNER_PROBE_PATTERNS = [
  /(^|\/)\.[^/]/,
  /(^|\/)\.config\/gcloud\//i,
  /(^|\/)(aws|s3|stripe|sendgrid|smtp|sftp|terraform|credentials?|secrets?|client[-_]secrets?|service[-_]account|appsettings|team-provider-info|claude_desktop_config|database)[-_.a-z0-9]*\.json$/i,
  /(^|\/)(aws|s3)\/(.*\/)?credentials$/i, // aws/s3/credentials, s3/credentials
  /(^|\/)(id_rsa|id_dsa|id_ecdsa|id_ed25519|dockerfile|phpinfo|nginx-status|server-status)$/i,
  /(^|\/)(gcp|google|firebase)[-_](credentials|service-account|cloud-key|adminsdk)\.json$/i,
  /(^|\/)(service-account|application_default_credentials)\.json$/i,
  /(^|\/)wlwmanifest\.xml$/i, // WordPress-enumeration scanner artifact
  /(^|\/)robots\.txt$/i, // crawler hits, not user traffic
];

export const BURST_WINDOW_MS = 10_000;
export const BURST_MIN_REQUESTS = 15;
export const BURST_ERROR_RATIO_THRESHOLD = 0.8;
export const BURST_PURGE_WINDOW_MS = 15_000;
export const BURST_EXEMPT_PATHS = ['/api/github/webhook'];

export const BOT_USER_AGENT_PATTERNS = [
  /^curl\//i,
  /^wget\//i,
  /python-(requests|httpx|urllib)/i,
  /go-http-client/i,
  /okhttp/i,
  /^java\//i,
  /libwww-perl/i,
  /^scrapy/i,
  /nuclei/i,
  /zgrab/i,
  /masscan/i,
  /^nmap/i,
  /censysinspect/i,
  /internet[- ]?measurement/i,
  /l9explore/i,
  /l9scan/i, // LeakIX
  /leakix/i,
  /expanse/i,
  /postmanruntime/i,
  /insomnia/i,
  /apache-httpclient/i,
  /node-fetch/i,
  /^axios\//i,
  /guzzlehttp/i,
];
