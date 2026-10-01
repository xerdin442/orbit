import type { ParsedAccessLogLine } from '@src/common/types';

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

  if (
    typeof method !== 'string' ||
    typeof uri !== 'string' ||
    typeof host !== 'string' ||
    typeof statusCode !== 'number' ||
    typeof duration !== 'number'
  ) {
    return null;
  }

  return {
    method,
    uri,
    hostname: host.split(':')[0],
    statusCode,
    durationMs: Math.round(duration * 1000),
  };
}
