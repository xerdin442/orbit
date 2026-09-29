import type { Command } from "commander";
import { api, OrbitApiError } from "../lib/api.js";
import { clearAll, setToken, clearToken, ensureAuth } from "../lib/config.js";
import { success, info } from "../lib/format.js";
import { startAuthServer } from "../lib/auth-server.js";
import { failWith } from "../lib/exit.js";

interface ProfileResponse {
  id: string;
  githubUsername: string;
  email?: string;
  avatarUrl?: string;
}

export function registerAuthCommands(program: Command) {
  const auth = program.command("auth").description("Manage authentication");

  auth
    .command("login")
    .description("Authenticate with GitHub")
    .option("--api-url <url>", "Orbit API URL (saved for later commands)")
    .action(async () => {
      try {
        const token = await startAuthServer();
        setToken(token);
        success("Logged in successfully.");
      } catch (err) {
        failWith(err, "Login failed");
      }
    });

  auth
    .command("logout")
    .description("Clear stored credentials")
    .action(() => {
      clearToken();
      success("Logged out.");
    });

  auth
    .command("whoami")
    .description("Show authenticated user")
    .action(async () => {
      try {
        ensureAuth();
        const user = await api.get<ProfileResponse>("/auth/me");
        console.log(`Logged in as ${user.githubUsername}`);
        if (user.email) {
          console.log(`Email: ${user.email}`);
        }
      } catch (err) {
        if (err instanceof OrbitApiError && err.status === 401) {
          clearToken();
          info("Session expired. Run `orbit auth login`.");
        } else {
          failWith(err, "Failed to fetch user profile");
        }
      }
    });

  auth
    .command("reset")
    .description("Clear all config and data")
    .action(() => {
      clearAll();
      success("All config cleared.");
    });
}
