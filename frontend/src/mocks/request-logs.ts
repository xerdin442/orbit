import type { RequestLog } from "@/lib/types";

const PATHS: [string, string | null][] = [
  ["/", null],
  ["/api/users", null],
  ["/api/users/42", null],
  ["/api/orders", "page=2&status=open"],
  ["/api/health", null],
  ["/api/webhooks/stripe", null],
  ["/static/app.js", null],
  ["/api/auth/session", null],
];

const METHOD_WEIGHTS: [string, number][] = [
  ["GET", 6],
  ["POST", 3],
  ["PUT", 1],
  ["PATCH", 1],
  ["DELETE", 1],
];

const STATUS_WEIGHTS: [number, number][] = [
  [200, 10],
  [201, 2],
  [304, 2],
  [400, 1],
  [404, 2],
  [500, 1],
];

function weightedPick<T>(weights: [T, number][], index: number): T {
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  let target = index % total;
  for (const [value, weight] of weights) {
    if (target < weight) return value;
    target -= weight;
  }
  return weights[0][0];
}

function generateEntries(
  environmentId: string,
  hostname: string,
  count: number,
  idPrefix: string,
): RequestLog[] {
  return Array.from({ length: count }, (_, i) => {
    const [path, query] = PATHS[i % PATHS.length];
    return {
      id: `${idPrefix}-${i}`,
      environmentId,
      hostname,
      method: weightedPick(METHOD_WEIGHTS, i),
      path,
      query,
      statusCode: weightedPick(STATUS_WEIGHTS, i * 3 + 1),
      durationMs: 8 + ((i * 37) % 420),
      timestamp: new Date(Date.now() - i * 45 * 1000).toISOString(),
    };
  });
}

export const requestLogsByEnv: Record<string, RequestLog[]> = {
  "env-1": generateEntries("env-1", "api.orbit.dev", 35, "req-env1"),
  "env-2": generateEntries("env-2", "staging.api.orbit.dev", 6, "req-env2"),
  "env-3": generateEntries("env-3", "app.orbit.dev", 4, "req-env3"),
};
