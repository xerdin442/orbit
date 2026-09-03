import type { ParsedAccessLogLine } from '@src/common/types';

const NOISE_PATH_PREFIXES = [
  '/_next/', // Next.js — chunks, /_next/image, /_next/data, .rsc segments
  '/_nuxt/', // Nuxt 3/4 — hashed bundles, /_nuxt/builds/meta/*.json
  '/_astro/', // Astro — hashed bundles
  '/_app/', // SvelteKit — reserved dir: /_app/immutable/*, /_app/version.json
  '/_vercel/', // @vercel/analytics + @vercel/speed-insights beacons
  '/.well-known/appspecific/', // Chrome DevTools probe on every page load
];

const NOISE_PATH_EXTENSIONS = [
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

function getHeader(headers: unknown, name: string): string | undefined {
  if (typeof headers !== 'object' || headers === null) return undefined;

  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(
    headers as Record<string, unknown>,
  )) {
    if (key.toLowerCase() === target && Array.isArray(value)) {
      return typeof value[0] === 'string' ? value[0] : undefined;
    }
  }

  return undefined;
}

function isPrefetch(headers: unknown): boolean {
  const secPurpose = getHeader(headers, 'sec-purpose');
  if (secPurpose && secPurpose.toLowerCase().includes('prefetch')) return true;

  const purpose = getHeader(headers, 'purpose'); // older Chrome/Firefox
  if (purpose && purpose.toLowerCase() === 'prefetch') return true;

  const moz = getHeader(headers, 'x-moz'); // Firefox
  if (moz && moz.toLowerCase() === 'prefetch') return true;

  // Next.js App Router <Link> prefetch
  if (getHeader(headers, 'next-router-prefetch')) return true;

  return false;
}

function normalizeQuery(rawQuery: string): string | undefined {
  if (!rawQuery) return undefined;

  const params = new URLSearchParams(rawQuery);
  params.delete('_rsc');

  const cleaned = params.toString();
  return cleaned ? cleaned.slice(0, 1024) : undefined;
}

export function isNoiseRequest(path: string): boolean {
  if (NOISE_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return true;
  }

  const lastSegment = path.split('/').pop() ?? '';
  const dot = lastSegment.lastIndexOf('.');
  if (dot <= 0) return false;

  return NOISE_PATH_EXTENSIONS.includes(lastSegment.slice(dot).toLowerCase());
}

export function parseAccessLogLine(line: string): ParsedAccessLogLine | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const entry = parsed as Record<string, unknown>;

  if (entry.logger !== 'http.log.access') return null;

  const request = entry.request;
  if (typeof request !== 'object' || request === null) return null;
  const req = request as Record<string, unknown>;

  const method = req.method;
  const uri = req.uri;
  const host = req.host;
  const statusCode = entry.status;
  const duration = entry.duration;
  const ts = entry.ts;

  if (
    typeof method !== 'string' ||
    typeof uri !== 'string' ||
    typeof host !== 'string' ||
    typeof statusCode !== 'number' ||
    typeof duration !== 'number'
  ) {
    return null;
  }

  // Drop CORS preflight requests
  if (
    method === 'OPTIONS' &&
    getHeader(req.headers, 'access-control-request-method')
  ) {
    return null;
  }

  // Drop speculative prefetches
  if (isPrefetch(req.headers)) return null;

  const q = uri.indexOf('?');
  const path = q === -1 ? uri : uri.slice(0, q);
  const query = q === -1 ? undefined : normalizeQuery(uri.slice(q + 1));

  if (isNoiseRequest(path)) return null;

  return {
    method,
    path,
    query,
    hostname: host.split(':')[0],
    statusCode,
    durationMs: Math.round(duration * 1000),
    timestamp: typeof ts === 'number' ? new Date(ts * 1000) : undefined,
  };
}
