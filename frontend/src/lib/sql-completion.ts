export const SQL_KEYWORDS = [
  "SELECT",
  "FROM",
  "WHERE",
  "AND",
  "OR",
  "NOT",
  "IN",
  "LIKE",
  "BETWEEN",
  "IS",
  "NULL",
  "AS",
  "JOIN",
  "INNER JOIN",
  "LEFT JOIN",
  "RIGHT JOIN",
  "ON",
  "GROUP BY",
  "ORDER BY",
  "HAVING",
  "LIMIT",
  "OFFSET",
  "DISTINCT",
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
  "ASC",
  "DESC",
  "UNION",
  "ALL",
  "SHOW",
  "DESCRIBE",
  "EXPLAIN",
];

const FROM_JOIN_PATTERN = /\b(?:FROM|JOIN)\s+([a-zA-Z_][\w]*)/gi;
const DOT_PREFIX_PATTERN = /([a-zA-Z_][\w]*)\.\s*$/;

export function extractReferencedTables(textBeforeCursor: string): string[] {
  const tables = new Set<string>();

  for (const match of textBeforeCursor.matchAll(FROM_JOIN_PATTERN)) {
    tables.add(match[1]);
  }

  const dotMatch = DOT_PREFIX_PATTERN.exec(textBeforeCursor);
  if (dotMatch) tables.add(dotMatch[1]);

  return [...tables];
}
