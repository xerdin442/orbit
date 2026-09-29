export interface EnvVar {
  key: string;
  value: string;
}

export function parseEnvFile(content: string): EnvVar[] {
  const vars: EnvVar[] = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;

    const key = trimmed
      .slice(0, eqIdx)
      .trim()
      .replace(/^export\s+/, "");
    let value = trimmed.slice(eqIdx + 1).trim();

    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }

    if (key) {
      vars.push({ key, value });
    }
  }

  return vars;
}

export function prepareImport(parsed: EnvVar[]): {
  vars: EnvVar[];
  empty: string[];
} {
  const byKey = new Map<string, string>();
  const empty: string[] = [];

  for (const { key, value } of parsed) {
    if (value === "") {
      empty.push(key);
      byKey.delete(key);
    } else {
      byKey.set(key, value);
    }
  }

  return {
    vars: [...byKey].map(([key, value]) => ({ key, value })),
    empty,
  };
}
