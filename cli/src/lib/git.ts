import { execSync } from "child_process";

export function getCurrentBranch(): string {
  const ciBranch =
    process.env.GITHUB_REF_NAME ?? // GitHub Actions
    process.env.CI_COMMIT_REF_NAME ?? // GitLab CI
    process.env.BRANCH_NAME; // Jenkins / generic

  if (ciBranch) return ciBranch;

  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf-8",
    }).trim();
  } catch {
    throw new Error(
      "Could not determine the current git branch. Run inside a git repository, or set BRANCH_NAME.",
    );
  }
}
