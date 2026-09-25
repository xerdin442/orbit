import type { ParsedAccessLogLine } from '@src/common/types';
import {
  BOT_USER_AGENT_PATTERNS,
  NOISE_PATH_EXTENSIONS,
  NOISE_PATH_PREFIXES,
  SCANNER_PROBE_EXTENSIONS,
  SCANNER_PROBE_PATTERNS,
} from './filters';

function decodePath(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

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

function isBotUserAgent(headers: unknown): boolean {
  const ua = getHeader(headers, 'user-agent');
  if (!ua) return false;

  return BOT_USER_AGENT_PATTERNS.some((pattern) => pattern.test(ua));
}

function isServerActionProbe(method: string, headers: unknown): boolean {
  if (method !== 'GET' && method !== 'HEAD') return false;
  return getHeader(headers, 'next-action') !== undefined;
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

  const decoded = decodePath(path);
  if (SCANNER_PROBE_PATTERNS.some((pattern) => pattern.test(decoded))) {
    return true;
  }

  const lastSegment = path.split('/').pop() ?? '';
  const dot = lastSegment.lastIndexOf('.');
  if (dot <= 0) return false;

  const extension = lastSegment.slice(dot).toLowerCase();
  return (
    NOISE_PATH_EXTENSIONS.includes(extension) ||
    SCANNER_PROBE_EXTENSIONS.includes(extension)
  );
}

export function isScannerQuery(rawQuery: string): boolean {
  if (!rawQuery) return false;

  const params = new URLSearchParams(rawQuery);
  return params.has('rest_route') || params.has('phpinfo');
}

function parseRequest(
  line: string,
): { entry: Record<string, unknown>; req: Record<string, unknown> } | null {
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

  return { entry, req: request as Record<string, unknown> };
}

export function parseAccessLogLine(line: string): ParsedAccessLogLine | null {
  const parsed = parseRequest(line);
  if (!parsed) return null;
  const { entry, req } = parsed;

  const method = req.method;
  const uri = req.uri;
  const host = req.host;
  const ip = req.client_ip ?? req.remote_ip;
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

  // Drop scripted HTTP clients and known vulnerability probes
  if (isBotUserAgent(req.headers)) return null;
  if (isServerActionProbe(method, req.headers)) return null;

  const q = uri.indexOf('?');
  const path = q === -1 ? uri : uri.slice(0, q);
  const query = q === -1 ? undefined : normalizeQuery(uri.slice(q + 1));

  if (isNoiseRequest(path)) return null;
  if (q !== -1 && isScannerQuery(uri.slice(q + 1))) return null;

  return {
    method,
    path,
    query,
    hostname: host.split(':')[0],
    statusCode,
    durationMs: Math.round(duration * 1000),
    timestamp: typeof ts === 'number' ? new Date(ts * 1000) : undefined,
    clientIp: typeof ip === 'string' ? ip : undefined,
  };
}
