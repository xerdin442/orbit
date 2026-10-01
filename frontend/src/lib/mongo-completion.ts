import type * as Monaco from "monaco-editor";

export const MONGO_METHODS = [
  "find",
  "findOne",
  "aggregate",
  "count",
  "countDocuments",
  "estimatedDocumentCount",
  "distinct",
  "explain",
];

const COLLECTION_PREFIX_PATTERN = /\bdb\.\s*$/;
const METHOD_PREFIX_PATTERN = /\bdb\.\w+\.\s*$/;

export function registerMongoCompletionProvider(
  monaco: typeof Monaco,
  options: {
    getCollectionNames: () => string[];
  },
): Monaco.IDisposable {
  return monaco.languages.registerCompletionItemProvider("javascript", {
    triggerCharacters: ["."],
    provideCompletionItems: (
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

      if (METHOD_PREFIX_PATTERN.test(textBeforeCursor)) {
        return {
          suggestions: MONGO_METHODS.map((method) => ({
            label: method,
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: `${method}(`,
            range,
          })),
        };
      }

      if (COLLECTION_PREFIX_PATTERN.test(textBeforeCursor)) {
        return {
          suggestions: options.getCollectionNames().map((name) => ({
            label: name,
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: name,
            range,
          })),
        };
      }

      return { suggestions: [] };
    },
  });
}
