import { stripVTControlCharacters } from "node:util";
import { describe, expect, it } from "vitest";
import { formatTable } from "../src/lib/format.js";

// What statusBadge() produces when colours are on: green "[ready]".
const green = (s: string) => `\u001b[32m${s}\u001b[39m`;

const visibleLines = (headers: string[], rows: string[][]) =>
  formatTable(headers, rows).map((line) => stripVTControlCharacters(line));

describe("formatTable", () => {
  it("aligns columns even when cells contain colour codes", () => {
    const lines = visibleLines(
      ["Status", "Commit", "Message"],
      [
        [green("[ready]"), "0fa5be0", "remove website redirect"],
        ["[failed]", "1a2b3c4", "fix build"],
      ],
    );

    // Each column starts at the same position on every line.
    const commitCol = lines[0]!.indexOf("Commit");
    const messageCol = lines[0]!.indexOf("Message");
    expect(lines[1]!.indexOf("0fa5be0")).toBe(commitCol);
    expect(lines[2]!.indexOf("1a2b3c4")).toBe(commitCol);
    expect(lines[1]!.indexOf("remove")).toBe(messageCol);
    expect(lines[2]!.indexOf("fix build")).toBe(messageCol);

    // Status is sized to its widest visible value, "[failed]", not the escape codes.
    expect(commitCol).toBe("[failed]".length + 2);
  });

  it("widens a column to fit its header", () => {
    const lines = visibleLines(["Hostname", "Type"], [["a.io", "custom"]]);
    expect(lines[1]!.indexOf("custom")).toBe(lines[0]!.indexOf("Type"));
  });

  it("doesn't pad the last column", () => {
    const lines = visibleLines(["Key", "Value"], [["A", "1"]]);
    for (const line of lines) expect(line).toBe(line.trimEnd());
  });

  it("treats missing cells as empty", () => {
    const lines = visibleLines(["A", "B", "C"], [["x"]]);
    expect(lines).toHaveLength(2);
    expect(lines[1]!.trimEnd()).toBe("x");
  });
});
