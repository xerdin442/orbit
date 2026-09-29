// Prompt types are plain strings that the TypeScript types don't check, so an
// inquirer upgrade that renames one (v14 dropped "list" for "select") only fails
// at runtime. Check every `type: "..."` in the commands against the registry.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import inquirer from "inquirer";
import { describe, expect, it } from "vitest";

const commandsDir = join(import.meta.dirname, "..", "src", "commands");

const usedTypes = readdirSync(commandsDir)
  .filter((file) => file.endsWith(".ts"))
  .flatMap((file) =>
    [
      ...readFileSync(join(commandsDir, file), "utf8").matchAll(
        /\btype:\s*"(\w+)"/g,
      ),
    ].map((match) => ({ file, type: match[1]! })),
  );

describe("inquirer prompt types", () => {
  it("finds prompts to check", () => {
    expect(usedTypes.length).toBeGreaterThan(0);
  });

  it.each(usedTypes)("$file uses a registered type ($type)", ({ type }) => {
    expect(Object.keys(inquirer.prompt.prompts)).toContain(type);
  });
});
