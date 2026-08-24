import type { Deployment } from "@/lib/types";

function randomSeconds(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min));
}

function completedAfter(createdAt: string, durationSeconds: number): string {
  return new Date(
    new Date(createdAt).getTime() + durationSeconds * 1000,
  ).toISOString();
}

const dep1CreatedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
const dep2CreatedAt = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
const dep3CreatedAt = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
const dep4CreatedAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

export const deployments: Deployment[] = [
  {
    id: "dep-1",
    commitSha: "a1b2c3d4e5f6g7h8i9j0",
    commitMessage: "feat: add user authentication",
    imageTag: "orbit-api:a1b2c3d",
    containerId: "container-001",
    trigger: "manual",
    buildStatus: "ready",
    failedStage: null,
    lifecycleStatus: "active",
    environmentId: "env-1",
    createdAt: dep1CreatedAt,
    completedAt: completedAfter(dep1CreatedAt, randomSeconds(4, 300)),
    updatedAt: dep1CreatedAt,
  },
  {
    id: "dep-2",
    commitSha: "b2c3d4e5f6g7h8i9j0a1",
    commitMessage: "fix: resolve CORS issue",
    imageTag: "orbit-api:b2c3d4e",
    containerId: "container-002",
    trigger: "webhook",
    buildStatus: "ready",
    failedStage: null,
    lifecycleStatus: "inactive",
    environmentId: "env-1",
    createdAt: dep2CreatedAt,
    completedAt: completedAfter(dep2CreatedAt, randomSeconds(5.6, 380)),
    updatedAt: dep2CreatedAt,
  },
  {
    id: "dep-3",
    commitSha: "c3d4e5f6g7h8i9j0a1b2",
    commitMessage: "chore: update dependencies",
    imageTag: "orbit-api:c3d4e5f",
    containerId: "container-003",
    trigger: "manual",
    buildStatus: "failed",
    failedStage: "building",
    lifecycleStatus: "aborted",
    environmentId: "env-2",
    createdAt: dep3CreatedAt,
    completedAt: completedAfter(dep3CreatedAt, randomSeconds(5, 55)),
    updatedAt: dep3CreatedAt,
  },
  {
    id: "dep-4",
    commitSha: "d4e5f6g7h8i9j0a1b2c3",
    commitMessage: "feat: add landing page redesign",
    imageTag: "orbit-frontend:d4e5f6g",
    containerId: "container-004",
    trigger: "manual",
    buildStatus: "ready",
    failedStage: null,
    lifecycleStatus: "active",
    environmentId: "env-3",
    createdAt: dep4CreatedAt,
    completedAt: completedAfter(dep4CreatedAt, randomSeconds(3, 250)),
    updatedAt: dep4CreatedAt,
  },
  {
    id: "dep-5",
    commitSha: "e5f6g7h8i9j0a1b2c3d4",
    commitMessage: "feat: add dark mode support",
    imageTag: "orbit-frontend:e5f6g7h",
    containerId: "container-005",
    trigger: "manual",
    buildStatus: "building",
    failedStage: null,
    lifecycleStatus: "inactive",
    environmentId: "env-3",
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    completedAt: null,
    updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
];

export const deploymentsByEnv: Record<string, Deployment[]> = {};
for (const d of deployments) {
  if (!deploymentsByEnv[d.environmentId]) {
    deploymentsByEnv[d.environmentId] = [];
  }
  deploymentsByEnv[d.environmentId].push(d);
}
