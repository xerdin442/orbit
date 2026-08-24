import type { EnvironmentVariable } from "@/lib/types";

export const environmentVariables: EnvironmentVariable[] = [
  {
    id: "var-1",
    key: "NODE_ENV",
    value: "production",
    generated: false,
    environmentId: "env-1",
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "var-2",
    key: "PORT",
    value: "3000",
    generated: false,
    environmentId: "env-1",
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "var-3",
    key: "JWT_SECRET",
    value: "s3cr3t-signing-key-do-not-share",
    generated: false,
    environmentId: "env-1",
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "var-6",
    key: "DATABASE_URL",
    value: "postgresql://orbit:s3cr3t@db.orbit.internal:5432/orbit_prod",
    generated: false,
    environmentId: "env-1",
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "var-7",
    key: "REDIS_URL",
    value: "redis://cache.orbit.internal:6379",
    generated: false,
    environmentId: "env-1",
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "var-8",
    key: "LOG_LEVEL",
    value: "info",
    generated: false,
    environmentId: "env-1",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "var-9",
    key: "STRIPE_SECRET_KEY",
    value: "sk_live_<MOCK-NOT-A-REAL-KEY>",
    generated: false,
    environmentId: "env-1",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "var-10",
    key: "SENTRY_DSN",
    value: "https://examplepublickey@o0.ingest.sentry.io/0",
    generated: false,
    environmentId: "env-1",
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "var-11",
    key: "S3_BUCKET_NAME",
    value: "orbit-api-prod-uploads",
    generated: false,
    environmentId: "env-1",
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "var-12",
    key: "S3_REGION",
    value: "us-east-1",
    generated: false,
    environmentId: "env-1",
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "var-13",
    key: "SMTP_HOST",
    value: "smtp.mailprovider.com",
    generated: false,
    environmentId: "env-1",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "var-14",
    key: "SMTP_PORT",
    value: "587",
    generated: false,
    environmentId: "env-1",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "var-15",
    key: "NODE_ENV",
    value: "development",
    generated: false,
    environmentId: "env-2",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "var-16",
    key: "NEXT_PUBLIC_API_URL",
    value: "https://api.orbit.dev",
    generated: false,
    environmentId: "env-3",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export const variablesByEnv: Record<string, EnvironmentVariable[]> = {};
for (const v of environmentVariables) {
  if (!variablesByEnv[v.environmentId]) {
    variablesByEnv[v.environmentId] = [];
  }
  variablesByEnv[v.environmentId].push(v);
}
