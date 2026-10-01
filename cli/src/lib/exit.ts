import { error } from "./format.js";

export class CliExit extends Error {
  constructor(public readonly code = 1) {
    super("CliExit");
    this.name = "CliExit";
  }
}

export function fail(message?: string): never {
  if (message) error(message);
  throw new CliExit(1);
}

export function failWith(err: unknown, fallback: string): never {
  if (err instanceof CliExit) throw err;
  fail(err instanceof Error ? err.message : fallback);
}
