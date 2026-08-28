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

  const path = uri.split('?')[0];
  if (isNoiseRequest(path)) return null;

  return {
    method,
    uri: path,
    hostname: host.split(':')[0],
    statusCode,
    durationMs: Math.round(duration * 1000),
    timestamp: typeof ts === 'number' ? new Date(ts * 1000) : undefined,
  };
}
