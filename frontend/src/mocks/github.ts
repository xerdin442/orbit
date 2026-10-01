import type {
  GitHubInstallation,
  GitHubRepository,
  GitHubBranch,
} from "@/lib/types";

export const githubInstallations: GitHubInstallation[] = [
  {
    installationId: 12345,
    accountLogin: "orbit-user",
    accountType: "User",
  },
  {
    installationId: 49012345,
    accountLogin: "acmecorp",
    accountType: "Organization",
  },
];

export const githubRepositories: Record<number, GitHubRepository[]> = {
  12345: [
    {
      id: 1,
      full_name: "orbit-user/orbit-api",
      name: "orbit-api",
      private: false,
    },
    {
      id: 2,
      full_name: "orbit-user/orbit-frontend",
      name: "orbit-frontend",
      private: false,
    },
    {
      id: 3,
      full_name: "orbit-user/experiments",
      name: "experiments",
      private: true,
    },
  ],
  49012345: [
    { id: 101, full_name: "acmecorp/web-api", name: "web-api", private: false },
    {
      id: 102,
      full_name: "acmecorp/admin-dashboard",
      name: "admin-dashboard",
      private: true,
    },
    {
      id: 103,
      full_name: "acmecorp/landing-page",
      name: "landing-page",
      private: false,
    },
  ],
};

export const githubBranches: Record<string, GitHubBranch[]> = {
  "orbit-user/orbit-api": [
    { name: "main" },
    { name: "develop" },
    { name: "feat/auth" },
  ],
  "orbit-user/orbit-frontend": [{ name: "main" }, { name: "redesign" }],
  "orbit-user/experiments": [{ name: "main" }],
  "acmecorp/web-api": [
    { name: "main" },
    { name: "develop" },
    { name: "feat/auth" },
  ],
  "acmecorp/admin-dashboard": [{ name: "main" }, { name: "staging" }],
  "acmecorp/landing-page": [{ name: "main" }],
};
