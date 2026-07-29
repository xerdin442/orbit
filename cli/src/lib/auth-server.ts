import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { exec } from 'node:child_process';
import { getApiUrl } from './config.js';

export function startAuthServer(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer(
      (req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(
          req.url ?? '/',
          `http://localhost:${(req.socket.address() as AddressInfo).port}`,
        );
        const token = url.searchParams.get('token');

        if (token) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(
            '<html><body><h1>Logged in!</h1><p>You can close this window.</p></body></html>',
          );
          server.close();
          resolve(token);
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(
            '<html><body><h1>Login failed</h1><p>No token received.</p></body></html>',
          );
          server.close();
          reject(new Error('No token in callback'));
        }
      },
    );

    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port;
      const redirectUri = `http://localhost:${port}/callback`;
      const loginUrl = `${getApiUrl()}/auth/github?redirect_uri=${encodeURIComponent(redirectUri)}`;

      const platform = process.platform;
      const openCmd =
        platform === 'darwin'
          ? 'open'
          : platform === 'win32'
            ? 'start'
            : 'xdg-open';

      exec(`${openCmd} "${loginUrl}"`, () => {});

      console.log(`Opening browser for authentication...`);
      console.log(`If the browser doesn't open, visit:\n${loginUrl}`);
    });

    setTimeout(() => {
      server.close();
      reject(new Error('Authentication timed out'));
    }, 120_000);
  });
}
