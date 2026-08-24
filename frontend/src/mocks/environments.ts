import type { Environment } from "@/lib/types";

export const environments: Record<string, Environment[]> = {
  "proj-1": [
    {
      id: "env-1",
      name: "production",
      branch: "main",
      autoDeploy: true,
      currentDeploymentId: null,
      projectId: "proj-1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "env-2",
      name: "staging",
      branch: "develop",
      autoDeploy: false,
      currentDeploymentId: null,
      projectId: "proj-1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  "proj-2": [
    {
      id: "env-3",
      name: "production",
      branch: "main",
      autoDeploy: true,
      currentDeploymentId: null,
      projectId: "proj-2",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
};
