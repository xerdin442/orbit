import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/config.js", () => ({
  getApiUrl: () => "https://orbit.test/api",
  ensureAuth: () => "session-jwt",
}));

const { api, apiFetch, OrbitApiError } = await import("../src/lib/api.js");

const fetchMock = vi.fn<typeof fetch>();

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api request", () => {
  it("prefixes the API URL and sends the session token", async () => {
    fetchMock.mockResolvedValue(json(200, { data: { ok: true } }));

    await api.get("/projects");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://orbit.test/api/projects");
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer session-jwt",
    );
  });

  it("uses the given auth headers instead of the session token", async () => {
    fetchMock.mockResolvedValue(json(200, { data: {} }));

    await api.post("/projects/p/deploy", {}, { "x-project-token": "pt" });

    const headers = fetchMock.mock.calls[0]![1]?.headers as Record<
      string,
      string
    >;
    expect(headers["x-project-token"]).toBe("pt");
    expect(headers.Authorization).toBeUndefined();
  });

  it("unwraps the { data } envelope", async () => {
    fetchMock.mockResolvedValue(json(200, { data: [{ id: "a" }] }));
    await expect(api.get("/projects")).resolves.toEqual([{ id: "a" }]);
  });

  it("returns paginated { data, meta } responses whole", async () => {
    const page = { data: [{ id: "d1" }], meta: { total: 1 } };
    fetchMock.mockResolvedValue(json(200, page));
    await expect(api.get("/environments/e/deployments")).resolves.toEqual(page);
  });

  it("returns undefined for 204 No Content", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(api.del("/domains/d")).resolves.toBeUndefined();
  });

  it("throws OrbitApiError(401) instead of exiting, so callers can react", async () => {
    fetchMock.mockResolvedValue(json(401, {}));

    const err = await api.get("/auth/me").catch((e: unknown) => e);

    expect(err).toBeInstanceOf(OrbitApiError);
    expect(err).toMatchObject({ status: 401 });
    expect((err as Error).message).toMatch(/orbit auth login/);
  });

  it("uses the project-token wording for a 401 with a project token", async () => {
    fetchMock.mockResolvedValue(json(401, {}));
    await expect(
      api.post("/projects/p/deploy", {}, { "x-project-token": "bad" }),
    ).rejects.toThrow(/project access token/);
  });

  it("surfaces the backend's { error: { message } } on failures", async () => {
    fetchMock.mockResolvedValue(
      json(400, { error: { message: "A deployment is already in progress" } }),
    );
    await expect(api.post("/environments/e/deploy")).rejects.toMatchObject({
      status: 400,
      message: "A deployment is already in progress",
    });
  });
});

describe("apiFetch", () => {
  it("names the API URL when the server can't be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(apiFetch("/projects")).rejects.toThrow(
      "Could not reach the Orbit API at https://orbit.test/api",
    );
  });
});
