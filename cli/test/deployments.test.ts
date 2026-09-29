import { describe, expect, it } from "vitest";
import { isInProgress, pickRollbackTarget } from "../src/lib/deployments.js";

const dep = (id: string, buildStatus: string, lifecycleStatus: string) => ({
  id,
  buildStatus,
  lifecycleStatus,
});

describe("pickRollbackTarget", () => {
  it("picks the newest successful deployment that isn't live", () => {
    const target = pickRollbackTarget([
      dep("live", "ready", "active"),
      dep("prev", "ready", "inactive"),
      dep("older", "ready", "inactive"),
    ]);
    expect(target?.id).toBe("prev");
  });

  it("skips failed and aborted deployments even though they're inactive", () => {
    const target = pickRollbackTarget([
      dep("failed", "failed", "aborted"),
      dep("aborted", "aborted", "aborted"),
      dep("failed-inactive", "failed", "inactive"),
      dep("live", "ready", "active"),
      dep("good", "ready", "inactive"),
    ]);
    expect(target?.id).toBe("good");
  });

  it("returns undefined when only the live deployment succeeded", () => {
    expect(
      pickRollbackTarget([
        dep("building", "building", "inactive"),
        dep("live", "ready", "active"),
      ]),
    ).toBeUndefined();
  });
});

describe("isInProgress", () => {
  it.each(["pending", "cloning", "building", "deploying"])(
    "treats %s as in progress",
    (status) => expect(isInProgress(status)).toBe(true),
  );

  it.each(["ready", "failed", "aborted"])("treats %s as finished", (status) =>
    expect(isInProgress(status)).toBe(false),
  );
});
