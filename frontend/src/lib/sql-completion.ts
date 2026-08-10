import type * as Monaco from "monaco-editor";
import type { TableColumn } from "@/lib/types";

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

export function registerSqlCompletionProvider(
  monaco: typeof Monaco,
  options: {
    getTableNames: () => string[];
    getColumnsForTable: (tableName: string) => Promise<TableColumn[]>;
  },
): Monaco.IDisposable {
  return monaco.languages.registerCompletionItemProvider("sql", {
    triggerCharacters: [" ", ".", ","],
    provideCompletionItems: async (
      model: Monaco.editor.ITextModel,
      position: Monaco.Position,
    ) => {
      const textBeforeCursor = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const tableNames = options.getTableNames();

      const suggestions: Monaco.languages.CompletionItem[] = [
        ...SQL_KEYWORDS.map((keyword) => ({
          label: keyword,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: keyword,
          range,
        })),
        ...tableNames.map((name) => ({
          label: name,
          kind: monaco.languages.CompletionItemKind.Class,
          insertText: name,
          range,
        })),
      ];

      const referencedTables = extractReferencedTables(textBeforeCursor).filter(
        (name) => tableNames.includes(name),
      );

      for (const table of referencedTables) {
        const columns = await options.getColumnsForTable(table);
        for (const column of columns) {
          suggestions.push({
            label: column.name,
            kind: monaco.languages.CompletionItemKind.Field,
            detail: column.type,
            insertText: column.name,
            range,
          });
        }
      }

      return { suggestions };
    },
  });
}
