import type { Resource } from "@/lib/types";

export const resources: Resource[] = [
  {
    id: "res-1",
    type: "postgres",
    name: "production-db",
    status: "ready",
    hostname: "postgres-prod.internal",
    ports: { "5432": 5432 },
    credentials: { DATABASE_URL: "postgresql://...", DATABASE_NAME: "orbit" },
    containerId: "pg-container-001",
    volumeId: "pg-volume-001",
    networkId: "net-001",
    environmentId: "env-1",
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "res-2",
    type: "redis",
    name: "Cache",
    status: "ready",
    hostname: "redis-prod.internal",
    ports: { "6379": 6379 },
    credentials: { REDIS_URL: "redis://..." },
    containerId: "redis-container-001",
    volumeId: null,
    networkId: "net-001",
    environmentId: "env-1",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "res-3",
    type: "postgres",
    name: "Staging DB",
    status: "provisioning",
    hostname: null,
    ports: null,
    credentials: null,
    containerId: null,
    volumeId: null,
    networkId: null,
    environmentId: "env-2",
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "res-4",
    type: "mysql",
    name: "Analytics DB",
    status: "ready",
    hostname: "mysql-analytics.internal",
    ports: { "3306": 3306 },
    credentials: {
      DATABASE_URL: "mysql://...",
      DATABASE_NAME: "analytics",
    },
    containerId: "mysql-container-001",
    volumeId: "mysql-volume-001",
    networkId: "net-001",
    environmentId: "env-1",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "res-5",
    type: "mongo",
    name: "Events Store",
    status: "unhealthy",
    hostname: "mongo-events.internal",
    ports: { "27017": 27017 },
    credentials: { DATABASE_URL: "mongodb://..." },
    containerId: "mongo-container-001",
    volumeId: "mongo-volume-001",
    networkId: "net-001",
    environmentId: "env-1",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export const resourcesByEnv: Record<string, Resource[]> = {};
for (const r of resources) {
  if (!resourcesByEnv[r.environmentId]) {
    resourcesByEnv[r.environmentId] = [];
  }
  resourcesByEnv[r.environmentId].push(r);
}
