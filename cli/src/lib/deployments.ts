export interface DeploymentSummary {
  id: string;
  buildStatus: string;
  lifecycleStatus: string;
}

const IN_PROGRESS_STATUSES = ["pending", "cloning", "building", "deploying"];

export function isInProgress(buildStatus: string): boolean {
  return IN_PROGRESS_STATUSES.includes(buildStatus);
}

export function pickRollbackTarget<T extends DeploymentSummary>(
  deployments: T[],
): T | undefined {
  return deployments.find(
    (d) => d.buildStatus === "ready" && d.lifecycleStatus === "inactive",
  );
}
