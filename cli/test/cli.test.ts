// Runs the built binary the way an installed user would. `npm test` builds first
// (pretest), so this catches a broken shebang, bad ESM import or missing dist file.
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

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
