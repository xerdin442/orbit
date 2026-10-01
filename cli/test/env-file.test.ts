import { describe, expect, it } from "vitest";
import { parseEnvFile, prepareImport } from "../src/lib/env-file.js";

describe("parseEnvFile", () => {
  it("parses KEY=value lines, skipping blanks, comments and lines without '='", () => {
    const content = [
      "# database",
      "DATABASE_URL=postgres://localhost/db",
      "",
      "not a variable",
      "   PORT = 3000   ",
    ].join("\n");

    expect(parseEnvFile(content)).toEqual([
      { key: "DATABASE_URL", value: "postgres://localhost/db" },
      { key: "PORT", value: "3000" },
    ]);
  });

  it("keeps everything after the first '=' as the value", () => {
    expect(parseEnvFile("TOKEN=abc==def=")).toEqual([
      { key: "TOKEN", value: "abc==def=" },
    ]);
  });

  it("strips one layer of matching single or double quotes", () => {
    expect(parseEnvFile(`A="hello world"\nB='x y'\nC="mismatched'`)).toEqual([
      { key: "A", value: "hello world" },
      { key: "B", value: "x y" },
      { key: "C", value: `"mismatched'` },
    ]);
  });

  it("does not treat a lone quote character as a quoted empty string", () => {
    expect(parseEnvFile(`Q="`)).toEqual([{ key: "Q", value: '"' }]);
  });

  it("strips a leading `export`", () => {
    expect(parseEnvFile("export API_KEY=secret")).toEqual([
      { key: "API_KEY", value: "secret" },
    ]);
  });

  it("handles CRLF line endings", () => {
    expect(parseEnvFile("A=1\r\nB=2\r\n")).toEqual([
      { key: "A", value: "1" },
      { key: "B", value: "2" },
    ]);
  });

  it("keeps empty values (filtering is prepareImport's job) and drops empty keys", () => {
    expect(parseEnvFile("EMPTY=\n=orphan")).toEqual([
      { key: "EMPTY", value: "" },
    ]);
  });
});

describe("prepareImport", () => {
  it("drops empty values and reports their keys", () => {
    expect(
      prepareImport([
        { key: "A", value: "1" },
        { key: "B", value: "" },
      ]),
    ).toEqual({ vars: [{ key: "A", value: "1" }], empty: ["B"] });
  });

  it("lets a later duplicate win, like dotenv", () => {
    expect(
      prepareImport([
        { key: "A", value: "first" },
        { key: "A", value: "second" },
      ]),
    ).toEqual({ vars: [{ key: "A", value: "second" }], empty: [] });
  });

  it("drops a key whose last occurrence is empty, even if an earlier one had a value", () => {
    expect(
      prepareImport([
        { key: "A", value: "set" },
        { key: "A", value: "" },
      ]),
    ).toEqual({ vars: [], empty: ["A"] });
  });
});
