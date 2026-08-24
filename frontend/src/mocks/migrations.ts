import type {
  ExternalProvider,
  ExternalProjectSummary,
  ExternalProjectDetail,
} from "@/lib/types";

export const externalProjectSummaries: Record<
  ExternalProvider,
  ExternalProjectSummary[]
> = {
  vercel: [
    {
      id: "vercel-marketing-site",
      name: "marketing-site",
      repoFullName: "orbit-user/orbit-frontend",
    },
    {
      id: "vercel-internal-cli",
      name: "internal-cli",
      repoFullName: null,
    },
    {
      id: "vercel-docs-site",
      name: "docs-site",
      repoFullName: "external-org/docs-site",
    },
  ],
  railway: [
    {
      id: "proj-api:env-prod:svc-api",
      name: "orbit-api",
      repoFullName: "orbit-user/orbit-api",
    },
    {
      id: "proj-platform:env-prod:svc-web",
      name: "Platform / web",
      groupLabel: "Platform",
      repoFullName: "acmecorp/web-api",
    },
    {
      id: "proj-platform:env-prod:svc-worker",
      name: "Platform / worker",
      groupLabel: "Platform",
      repoFullName: "acmecorp/admin-dashboard",
    },
  ],
};

export const externalProjectDetails: Record<string, ExternalProjectDetail> = {
  "vercel-marketing-site": {
    id: "vercel-marketing-site",
    name: "marketing-site",
    repoFullName: "orbit-user/orbit-frontend",
    defaultBranch: "main",
    envVars: [
      { key: "NEXT_PUBLIC_API_URL", value: "https://api.marketing.example.com" },
      { key: "ANALYTICS_ID", value: "UA-000000-1" },
    ],
    domains: ["marketing.example.com"],
    buildDirectory: "apps/marketing",
  },
  "vercel-docs-site": {
    id: "vercel-docs-site",
    name: "docs-site",
    repoFullName: "external-org/docs-site",
    defaultBranch: "main",
    envVars: [{ key: "SEARCH_API_KEY", value: "sk_docs_search_000" }],
    domains: ["docs.example.com"],
  },
  "proj-api:env-prod:svc-api": {
    id: "proj-api:env-prod:svc-api",
    name: "orbit-api",
    repoFullName: "orbit-user/orbit-api",
    defaultBranch: "main",
    envVars: [
      { key: "DATABASE_URL", value: "postgres://user:pass@old-host:5432/orbit" },
      { key: "REDIS_URL", value: "redis://old-host:6379" },
    ],
    domains: ["api.orbit-user-old.up.railway.app"],
  },
  "proj-platform:env-prod:svc-web": {
    id: "proj-platform:env-prod:svc-web",
    name: "Platform / web",
    repoFullName: "acmecorp/web-api",
    defaultBranch: "main",
    envVars: [{ key: "NODE_ENV", value: "production" }],
    domains: ["web.acmecorp-old.up.railway.app"],
  },
  "proj-platform:env-prod:svc-worker": {
    id: "proj-platform:env-prod:svc-worker",
    name: "Platform / worker",
    repoFullName: "acmecorp/admin-dashboard",
    defaultBranch: "staging",
    envVars: [{ key: "QUEUE_CONCURRENCY", value: "4" }],
    domains: [],
  },
};
