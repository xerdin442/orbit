import { afterEach, describe, expect, it, vi } from "vitest";
import { CliExit, fail, failWith } from "../src/lib/exit.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fail", () => {
  it("prints the message and throws CliExit(1) instead of exiting", () => {
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => fail("boom")).toThrow(CliExit);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining("boom"));
  });
});

describe("failWith", () => {
  it("passes an existing CliExit through without printing again", () => {
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
    const exit = new CliExit(1);

    expect(() => failWith(exit, "fallback")).toThrow(exit);
    expect(stderr).not.toHaveBeenCalled();
  });

  it("prints an Error's message, or the fallback for anything else", () => {
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => failWith(new Error("request failed"), "fallback")).toThrow(
      CliExit,
    );
    expect(() => failWith("weird", "fallback")).toThrow(CliExit);

    expect(stderr).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("request failed"),
    );
    expect(stderr).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("fallback"),
    );
  });
});
