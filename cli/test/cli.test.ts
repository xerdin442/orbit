// Runs the built binary the way an installed user would. `npm test` builds first
// (pretest), so this catches a broken shebang, bad ESM import or missing dist file.
import { spawn, spawnSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

const root = join(import.meta.dirname, "..");
const bin = join(root, "dist", "index.js");
const { version } = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8"),
) as { version: string };

let configDir: string;

function orbit(args: string[], env: Record<string, string> = {}) {
  const baseEnv = { ...process.env };
  delete baseEnv.ORBIT_API_URL;

  const result = spawnSync(process.execPath, [bin, ...args], {
    encoding: "utf8",
    env: { ...baseEnv, ORBIT_CONFIG_DIR: configDir, NO_COLOR: "1", ...env },
    timeout: 15_000,
  });

  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}`,
  };
}

/** Like orbit(), but async so a fake API in this process can answer, and timed. */
function orbitAsync(args: string[], env: Record<string, string> = {}) {
  const baseEnv = { ...process.env };
  delete baseEnv.ORBIT_API_URL;
  const started = Date.now();

  return new Promise<{ status: number | null; output: string; ms: number }>(
    (resolve) => {
      const child = spawn(process.execPath, [bin, ...args], {
        env: { ...baseEnv, ORBIT_CONFIG_DIR: configDir, NO_COLOR: "1", ...env },
      });
      let output = "";
      child.stdout.on("data", (chunk) => (output += chunk));
      child.stderr.on("data", (chunk) => (output += chunk));
      child.on("close", (status) =>
        resolve({ status, output, ms: Date.now() - started }),
      );
    },
  );
}

/** A logged-in, linked config pointing at the given API. */
function writeLinkedConfig(apiUrl: string) {
  writeFileSync(
    join(configDir, "config.json"),
    JSON.stringify({
      apiUrl,
      token: "test-jwt",
      currentContext: {
        projectId: "proj-1",
        environmentId: "env-1",
        projectName: "demo",
      },
    }),
  );
}

beforeAll(() => {
  if (!existsSync(bin)) {
    throw new Error(
      "dist/ is missing: run `npm run build` (npm test does this)",
    );
  }
});

beforeEach(() => {
  configDir = mkdtempSync(join(tmpdir(), "orbit-cli-test-"));
});

afterEach(() => {
  rmSync(configDir, { recursive: true, force: true });
});

describe("orbit binary", () => {
  it("reports the package.json version", () => {
    const { status, output } = orbit(["--version"]);
    expect(status).toBe(0);
    expect(output.trim()).toBe(version);
  });

  it("lists every command in --help", () => {
    const { status, output } = orbit(["--help"]);
    expect(status).toBe(0);
    for (const command of [
      "auth",
      "init",
      "link",
      "deploy",
      "logs",
      "list",
      "env",
      "domains",
      "info",
      "redeploy",
      "rollback",
      "abort",
    ]) {
      expect(output).toMatch(new RegExp(`^\\s+${command}\\b`, "m"));
    }
  });

  it("refuses to run without an API URL and explains how to set one", () => {
    const { status, output } = orbit(["info"]);
    expect(status).toBe(1);
    expect(output).toContain("No Orbit API URL is configured.");
    expect(output).toContain("orbit auth login --api-url");
  });

  it.each([
    ["auth", "logout"],
    ["auth", "reset"],
  ])("runs `orbit %s %s` without an API URL", (...args) => {
    expect(orbit(args).status).toBe(0);
  });

  it("rejects an invalid API URL", () => {
    const { status, output } = orbit(["--api-url", "ftp://x.test", "info"]);
    expect(status).toBe(1);
    expect(output).toContain("Invalid Orbit API URL");
  });

  it("saves --api-url to an owner-only config file, normalised", () => {
    // Reaches the auth check, so the URL was accepted and saved first.
    const { status, output } = orbit([
      "--api-url",
      "https://orbit.example.test/api/",
      "info",
    ]);
    expect(status).toBe(1);
    expect(output).toContain("Not authenticated");

    const file = join(configDir, "config.json");
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({
      apiUrl: "https://orbit.example.test/api",
    });
    if (process.platform !== "win32") {
      expect(statSync(file).mode & 0o777).toBe(0o600);
    }
  });

  it("uses ORBIT_API_URL without saving it", () => {
    const { output } = orbit(["info"], {
      ORBIT_API_URL: "https://orbit.example.test/api",
    });
    expect(output).toContain("Not authenticated");
    expect(existsSync(join(configDir, "config.json"))).toBe(false);
  });

  it("warns when a non-local API URL uses plain http", () => {
    const { output } = orbit(["info"], {
      ORBIT_API_URL: "http://orbit.example.test/api",
    });
    expect(output).toContain("uses plain http://");
  });

  it("requires a project ID when deploying with a project token", () => {
    const { status, output } = orbit(["deploy"], {
      ORBIT_API_URL: "https://orbit.example.test/api",
      ORBIT_TOKEN: "token",
    });
    expect(status).toBe(1);
    expect(output).toContain("ORBIT_PROJECT_ID");
  });
});

describe("failing after an API request", () => {
  let server: Server;
  let apiUrl: string;

  beforeAll(async () => {
    // Keep-alive connections (Node's default) are what used to be mid-close when
    // the CLI called process.exit(), crashing Node on Windows.
    server = createServer((req, res) => {
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/api/environments/env-1/domains") {
        res.end(
          JSON.stringify({
            data: [
              {
                id: "d1",
                hostname: "demo-abc1234.apps.example.test",
                type: "managed",
                status: "active",
              },
            ],
          }),
        );
        return;
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ error: { message: "Not found" } }));
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    apiUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  });

  afterAll(() => {
    server.closeAllConnections();
    server.close();
  });

  it("explains that the managed domain can't be removed, and exits 1 promptly", async () => {
    writeLinkedConfig(apiUrl);

    const { status, output, ms } = await orbitAsync([
      "domains",
      "rm",
      "demo-abc1234.apps.example.test",
    ]);

    expect(status).toBe(1);
    expect(output).toContain("managed Orbit domain and can't be removed");
    expect(output).not.toContain("Assertion failed");
    // Exits on its own, well before the 2s safety net in index.ts would force it.
    expect(ms).toBeLessThan(1_500);
  });

  it("reports a missing domain as not found", async () => {
    writeLinkedConfig(apiUrl);

    const { status, output } = await orbitAsync([
      "domains",
      "rm",
      "nope.example.test",
    ]);

    expect(status).toBe(1);
    expect(output).toContain('Domain "nope.example.test" not found');
  });
});
