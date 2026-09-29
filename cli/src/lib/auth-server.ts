import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { spawn } from "node:child_process";
import { apiFetch } from "./api.js";
import { info } from "./format.js";

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize?";

function openBrowser(url: string) {
  const [command, args]: [string, string[]] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? // Opens the default browser without going through cmd.exe.
          ["rundll32", ["url.dll,FileProtocolHandler", url]]
        : ["xdg-open", [url]];

  spawn(command, args, { stdio: "ignore", detached: true })
    .on("error", () => {})
    .unref();
}

export async function fetchLoginUrl(redirectUri: string): Promise<string> {
  const response = await apiFetch(
    `/auth/github?redirect_uri=${encodeURIComponent(redirectUri)}`,
  );

  if (!response.ok) {
    throw new Error(
      `Could not start login (${response.status} ${response.statusText})`,
    );
  }

  const json = (await response.json()) as { data?: { url?: string } };
  if (!json.data?.url) {
    throw new Error("Could not start login: no authorization URL returned");
  }

  // The backend should only ever return GitHub's authorize URL
  if (!json.data.url.startsWith(GITHUB_AUTHORIZE_URL)) {
    throw new Error("Could not start login: unexpected authorization URL");
  }

  return json.data.url;
}

export function startAuthServer(): Promise<string> {
  return new Promise((resolve, reject) => {
    const finish = (err: Error | null, token?: string) => {
      clearTimeout(timeout);
      server.close();
      if (err) reject(err);
      else resolve(token!);
    };

    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(
        req.url ?? "/",
        `http://localhost:${(req.socket.address() as AddressInfo).port}`,
      );

      if (url.pathname !== "/callback") {
        res.writeHead(404).end();
        return;
      }

      const token = url.searchParams.get("token");

      if (token) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          "<html><body><h1>Logged in!</h1><p>You can close this window.</p></body></html>",
        );
        finish(null, token);
      } else {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(
          "<html><body><h1>Login failed</h1><p>Authentication failed.</p></body></html>",
        );
        finish(new Error("No token in callback"));
      }
    });

    const timeout = setTimeout(() => {
      finish(new Error("Authentication timed out"));
    }, 120_000);

    server.listen(0, "127.0.0.1", async () => {
      const port = (server.address() as AddressInfo).port;
      const redirectUri = `http://localhost:${port}/callback`;

      let loginUrl: string;
      try {
        loginUrl = await fetchLoginUrl(redirectUri);
      } catch (err) {
        finish(err instanceof Error ? err : new Error("Could not start login"));
        return;
      }

      openBrowser(loginUrl);

      console.log(`Opening browser for authentication...`);
      console.log(`If the browser doesn't open, visit:`);
      info(loginUrl);
    });
  });
}
