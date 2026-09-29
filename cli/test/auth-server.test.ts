import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/config.js", () => ({
  getApiUrl: () => "https://orbit.test/api",
  ensureAuth: () => "session-jwt",
}));

const { fetchLoginUrl } = await import("../src/lib/auth-server.js");

const fetchMock = vi.fn<typeof fetch>();
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

const GITHUB_URL =
  "https://github.com/login/oauth/authorize?client_id=abc&state=xyz";

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchLoginUrl", () => {
  it("asks the backend for the authorize URL, passing the local callback", async () => {
    fetchMock.mockResolvedValue(json(200, { data: { url: GITHUB_URL } }));

    await expect(
      fetchLoginUrl("http://localhost:51234/callback"),
    ).resolves.toBe(GITHUB_URL);

    expect(fetchMock.mock.calls[0]![0]).toBe(
      "https://orbit.test/api/auth/github?redirect_uri=http%3A%2F%2Flocalhost%3A51234%2Fcallback",
    );
  });

  it("refuses a URL that isn't GitHub's authorize endpoint", async () => {
    fetchMock.mockResolvedValue(
      json(200, { data: { url: "https://evil.example.com/login" } }),
    );
    await expect(fetchLoginUrl("http://localhost:1/callback")).rejects.toThrow(
      "unexpected authorization URL",
    );
  });

  it("refuses a lookalike host that merely starts with github.com", async () => {
    fetchMock.mockResolvedValue(
      json(200, {
        data: { url: "https://github.com.evil.example/login/oauth/authorize?" },
      }),
    );
    await expect(fetchLoginUrl("http://localhost:1/callback")).rejects.toThrow(
      "unexpected authorization URL",
    );
  });

  it("errors when the response has no URL", async () => {
    fetchMock.mockResolvedValue(json(200, { data: {} }));
    await expect(fetchLoginUrl("http://localhost:1/callback")).rejects.toThrow(
      "no authorization URL returned",
    );
  });

  it("errors with the status on a non-2xx response", async () => {
    fetchMock.mockResolvedValue(
      new Response("nope", { status: 401, statusText: "Unauthorized" }),
    );
    await expect(fetchLoginUrl("http://localhost:1/callback")).rejects.toThrow(
      "Could not start login (401 Unauthorized)",
    );
  });
});
