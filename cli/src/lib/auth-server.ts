import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { exec } from "node:child_process";
import { getApiUrl } from "./config.js";

async function fetchLoginUrl(redirectUri: string): Promise<string> {
  const response = await fetch(
    `${getApiUrl()}/auth/github?redirect_uri=${encodeURIComponent(redirectUri)}`,
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

      const platform = process.platform;
      const openCmd =
        platform === "darwin"
          ? "open"
          : platform === "win32"
            ? 'start ""'
            : "xdg-open";

      exec(`${openCmd} "${loginUrl}"`, () => {});

      console.log(`Opening browser for authentication...`);
      console.log(`If the browser doesn't open, visit:\n${loginUrl}`);
    });
  });
}
