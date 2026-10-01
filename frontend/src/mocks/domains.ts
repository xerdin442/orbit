import type { Domain } from "@/lib/types";

export const domains: Domain[] = [
  {
    id: "dom-1",
    hostname: "api.orbit.dev",
    type: "managed",
    status: "active",
    verifiedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    environmentId: "env-1",
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "dom-2",
    hostname: "staging.api.orbit.dev",
    type: "managed",
    status: "active",
    verifiedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    environmentId: "env-2",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "dom-3",
    hostname: "app.orbit.dev",
    type: "managed",
    status: "active",
    verifiedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    environmentId: "env-3",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "dom-4",
    hostname: "app.example.com",
    type: "custom",
    status: "verifying",
    verifiedAt: null,
    environmentId: "env-1",
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
  {
    id: "dom-5",
    hostname: "shop.example.com",
    type: "custom",
    status: "failed",
    verifiedAt: null,
    environmentId: "env-1",
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
];

export const domainsByEnv: Record<string, Domain[]> = {};
for (const d of domains) {
  if (!domainsByEnv[d.environmentId]) {
    domainsByEnv[d.environmentId] = [];
  }
  domainsByEnv[d.environmentId].push(d);
}
