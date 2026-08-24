import type { User } from "@/lib/types";

export const user: User = {
  id: "mock-user-1",
  githubUserId: 12345,
  githubUsername: "orbit-user",
  email: "user@example.com",
  avatarUrl: null,
  createdAt: new Date().toISOString(),
  slackInstallation: {
    teamId: "T02ABCDEF",
    teamName: "Acme Corp",
    installerSlackUserId: "U03GHIJKL",
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  externalConnections: [],
};
