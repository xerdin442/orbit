"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Editor, { type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { ArrowLeft, Database, Play, Table2 } from "lucide-react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/shared/skeleton";
import { LoadingButton } from "@/components/shared/loading-button";
import { Button } from "@/components/ui/button";
import { ResourceTableData } from "@/components/resource/resource-table-data";
import { api } from "@/lib/api";
import { cn, RESOURCE_TYPE_LABELS, supportsWorkbench } from "@/lib/utils";
import { SQL_KEYWORDS, extractReferencedTables } from "@/lib/sql-completion";
import type {
  DatabaseSchema,
  QueryResult,
  ResourceType,
  TableColumn,
  TableObject,
} from "@/lib/types";

function monacoLanguage(resourceType: ResourceType): string {
  return resourceType === "mongo" ? "json" : "sql";
}

function starterQuery(resourceType: ResourceType, table: TableObject): string {
  if (resourceType === "mongo") {
    return JSON.stringify(
      { operation: "find", collection: table.name, filter: {} },
      null,
      2,
    );
  }

  const identifier = table.schema
    ? `${table.schema}.${table.name}`
    : table.name;
  return `SELECT * FROM ${identifier} LIMIT 100;`;
}

export default function WorkbenchPage() {
  const { projectId, resourceId } = useParams<{
    projectId: string;
    resourceId: string;
  }>();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedDbs, setExpandedDbs] = useState<Set<string>>(new Set());
  const [schemaSeededFor, setSchemaSeededFor] = useState<string | null>(null);

  const { data: resource, isLoading: resourceLoading } = useQuery({
    queryKey: ["resource", resourceId],
    queryFn: () => api.resources.get(resourceId),
  });

  const workbenchSupported = !!resource && supportsWorkbench(resource.type);
  const accessible =
    !!resource && workbenchSupported && resource.status === "ready";

  useEffect(() => {
    if (resource && !accessible) {
      router.replace(`/projects/${projectId}/resources/${resourceId}`);
    }
  }, [resource, accessible, projectId, resourceId, router]);

  const { data: schemaResponse, isLoading: schemaLoading } = useQuery({
    queryKey: ["workbench", "schema", resourceId],
    queryFn: () => api.workbench.schema(resourceId),
    enabled: accessible,
  });
  const databases = useMemo(
    () => schemaResponse?.databases ?? [],
    [schemaResponse],
  );

  if (databases.length > 0 && schemaSeededFor !== resourceId) {
    setSchemaSeededFor(resourceId);
    setExpandedDbs(new Set([databases[0].name]));
  }

  const databasesRef = useRef<DatabaseSchema[]>(databases);
  useEffect(() => {
    databasesRef.current = databases;
  }, [databases]);

  const columnsCache = useRef<Map<string, TableColumn[]>>(new Map());
  const getColumnsForTable = async (
    tableName: string,
  ): Promise<TableColumn[]> => {
    const cached = columnsCache.current.get(tableName);
    if (cached) return cached;

    try {
      const data = await api.workbench.tableData(resourceId, tableName, {
        limit: 1,
      });
      columnsCache.current.set(tableName, data.columns);
      return data.columns;
    } catch {
      return [];
    }
  };

  const completionDisposables = useRef<{ dispose(): void }[]>([]);
  useEffect(() => {
    return () => {
      completionDisposables.current.forEach((d) => d.dispose());
      completionDisposables.current = [];
    };
  }, []);

  const toggleDb = (name: string) => {
    setExpandedDbs((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const selectTable = (table: TableObject) => {
    if (!resource) return;
    setQuery(starterQuery(resource.type, table));
  };

  const runQuery = async () => {
    if (!query.trim() || isRunning) return;

    setIsRunning(true);
    setQueryError(null);
    try {
      const data = await api.workbench.executeQuery(resourceId, query);
      setResult(data);
    } catch (error) {
      setResult(null);
      setQueryError(
        error instanceof Error ? error.message : "Query execution failed",
      );
    } finally {
      setIsRunning(false);
    }
  };

  const handleEditorMount: OnMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      void runQuery();
    });

    if (resource && monacoLanguage(resource.type) === "sql") {
      const disposable = monaco.languages.registerCompletionItemProvider(
        "sql",
        {
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

            const tableNames = databasesRef.current.flatMap((db) =>
              db.objects.map((o) => o.name),
            );

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

            const referencedTables = extractReferencedTables(
              textBeforeCursor,
            ).filter((name) => tableNames.includes(name));

            for (const table of referencedTables) {
              const columns = await getColumnsForTable(table);
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
        },
      );

      completionDisposables.current.push(disposable);
    }
  };

  if (resourceLoading || !resource || !accessible) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-100 w-full" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={`${resource.name} Workbench`}>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() =>
            router.push(`/projects/${projectId}/resources/${resourceId}`)
          }
        >
          <ArrowLeft className="size-3.5" />
          Back
        </Button>
      </PageHeader>

      <div className="min-h-0 flex-1 rounded-lg border border-border">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel defaultSize="22" minSize="15" maxSize="40">
            <div className="custom-scrollbar h-full space-y-1 overflow-y-auto p-2">
              {schemaLoading && <Skeleton className="h-8 w-full" />}
              {!schemaLoading && databases.length === 0 && (
                <p className="p-2 text-[0.8125rem] text-muted-foreground">
                  No schema found.
                </p>
              )}
              {databases.map((db) => (
                <div key={db.name}>
                  <button
                    onClick={() => toggleDb(db.name)}
                    className="flex w-full cursor-pointer items-center gap-1.5 truncate rounded-md px-2 py-1.5 text-left text-sm font-medium text-foreground hover:bg-muted"
                  >
                    <Database className="size-3.5 shrink-0 text-muted-foreground" />
                    {db.name}
                  </button>
                  {expandedDbs.has(db.name) && (
                    <div className="ml-3 space-y-0.5 border-l border-border pl-2">
                      {db.objects.map((obj) => (
                        <button
                          key={`${obj.schema ?? ""}.${obj.name}`}
                          onClick={() => selectTable(obj)}
                          className="flex w-full cursor-pointer items-center gap-1.5 truncate rounded-md px-2 py-1 text-left font-mono text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Table2 className="size-3 shrink-0" />
                          {obj.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize="78">
            <ResizablePanelGroup orientation="vertical">
              <ResizablePanel defaultSize="45" minSize="20">
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
                    <span className="text-xs text-muted-foreground">
                      {RESOURCE_TYPE_LABELS[resource.type]} —{" "}
                      {monacoLanguage(resource.type) === "sql"
                        ? "read-only SQL"
                        : "read-only query (JSON)"}
                    </span>
                    <LoadingButton
                      size="sm"
                      loading={isRunning}
                      disabled={!query.trim()}
                      onClick={runQuery}
                    >
                      <Play className="size-3.5" />
                      Run
                    </LoadingButton>
                  </div>
                  <div className="min-h-0 flex-1 overflow-hidden">
                    <Editor
                      height="100%"
                      language={monacoLanguage(resource.type)}
                      theme="vs-dark"
                      value={query}
                      onChange={(v) => setQuery(v ?? "")}
                      onMount={handleEditorMount}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        scrollbar: {
                          verticalScrollbarSize: 8,
                          horizontalScrollbarSize: 8,
                        },
                      }}
                    />
                  </div>
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              <ResizablePanel defaultSize="55" minSize="20">
                <div
                  className={cn(
                    "custom-scrollbar h-full overflow-auto",
                    !result &&
                      !queryError &&
                      "flex items-center justify-center",
                  )}
                >
                  {queryError ? (
                    <ErrorState
                      title="Query failed"
                      description={queryError}
                      className="py-10"
                    />
                  ) : result ? (
                    <ResourceTableData
                      columns={result.columns}
                      rows={result.rows}
                      isLoading={isRunning}
                    />
                  ) : (
                    <EmptyState
                      icon={Play}
                      title="Run a query"
                      description="Write a read-only query above and run it (or press Cmd/Ctrl+Enter) to see results here."
                      className="py-10"
                    />
                  )}
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
