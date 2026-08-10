"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Route, SearchX } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { TimestampDisplay } from "@/components/shared/timestamp-display";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSelectedEnvironment } from "@/hooks/use-selected-environment";
import { useSSE } from "@/hooks/use-sse";
import { requestStatusVariant } from "@/lib/utils";
import { STATUS_CLASSES } from "@/lib/types";
import type { RequestLog, StatusClass } from "@/lib/types";

const PAGE_SIZE = 20;
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const MOCK_MODE = process.env.NEXT_PUBLIC_MOCK_MODE === "true";

export default function LogsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { selectedEnvironment } = useSelectedEnvironment(projectId);

  const [pageIndex, setPageIndex] = useState(0);
  const [method, setMethod] = useState<string>("all");
  const [statusClass, setStatusClass] = useState<StatusClass | "all">("all");
  const [streamedEntries, setStreamedEntries] = useState<RequestLog[]>([]);
  const [streamedForEnv, setStreamedForEnv] = useState<string | null>(null);

  const hasFilters = method !== "all" || statusClass !== "all";
  const isFirstPage = pageIndex === 0;

  if (selectedEnvironment && streamedForEnv !== selectedEnvironment.id) {
    setStreamedForEnv(selectedEnvironment.id);
    setStreamedEntries([]);
  }

  const { data, isLoading } = useQuery({
    queryKey: [
      "requests",
      selectedEnvironment?.id,
      pageIndex,
      method,
      statusClass,
    ],
    queryFn: () =>
      selectedEnvironment
        ? api.requestLogs.list(selectedEnvironment.id, {
            page: pageIndex + 1,
            limit: PAGE_SIZE,
            method: method === "all" ? undefined : method,
            statusClass: statusClass === "all" ? undefined : statusClass,
          })
        : null,
    enabled: !!selectedEnvironment,
  });

  const { data: domains } = useQuery({
    queryKey: ["domains", selectedEnvironment?.id],
    queryFn: () =>
      selectedEnvironment ? api.domains.list(selectedEnvironment.id) : null,
    enabled: !!selectedEnvironment,
  });

  const isLive = isFirstPage && !hasFilters && !MOCK_MODE;
  const streamUrl =
    isLive && selectedEnvironment
      ? api.requestLogs.streamUrl(selectedEnvironment.id)
      : null;

  useSSE<RequestLog>(streamUrl, (entry) => {
    setStreamedEntries((prev) =>
      prev.some((e) => e.id === entry.id) ? prev : [entry, ...prev],
    );
  });

  const persisted = data?.data ?? [];
  const rows = isLive
    ? [
        ...streamedEntries.filter((e) => !persisted.some((p) => p.id === e.id)),
        ...persisted,
      ]
    : persisted;
  const primaryHostname = domains?.[0]?.hostname;

  const clearFilters = () => {
    setMethod("all");
    setStatusClass("all");
    setPageIndex(0);
  };

  const columns: ColumnDef<RequestLog>[] = [
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge variant={requestStatusVariant(row.original.statusCode)}>
          {row.original.statusCode}
        </StatusBadge>
      ),
    },
    {
      id: "method",
      header: "Method",
      cell: ({ row }) => (
        <span className="font-mono text-xs font-medium text-foreground">
          {row.original.method}
        </span>
      ),
    },
    {
      accessorKey: "uri",
      header: "Path",
      cell: ({ row }) => (
        <span
          className="block max-w-md truncate font-mono text-xs text-foreground"
          title={row.original.uri}
        >
          {row.original.uri}
        </span>
      ),
    },
    {
      id: "hostname",
      header: "Host",
      cell: ({ row }) => (
        <span className="truncate text-xs text-muted-foreground">
          {row.original.hostname}
        </span>
      ),
    },
    {
      id: "duration",
      header: "Duration",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.durationMs}ms
        </span>
      ),
    },
    {
      id: "timestamp",
      header: "Time",
      cell: ({ row }) => (
        <TimestampDisplay
          value={row.original.timestamp}
          className="text-xs text-muted-foreground"
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Logs" description="View all incoming HTTP requests" />

      <div className="mb-4 -mt-6 mr-1 flex items-center justify-end gap-2">
        <Select
          value={method}
          onValueChange={(v) => {
            if (!v) return;
            setMethod(v);
            setPageIndex(0);
          }}
        >
          <SelectTrigger className="h-9 w-32 text-[0.8125rem]">
            <SelectValue>
              {(v: string) => (v === "all" ? "All methods" : v)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All methods</SelectItem>
            {HTTP_METHODS.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={statusClass}
          onValueChange={(v) => {
            if (!v) return;
            setStatusClass(v as StatusClass | "all");
            setPageIndex(0);
          }}
        >
          <SelectTrigger className="h-9 w-32 text-[0.8125rem]">
            <SelectValue>
              {(v: string) => (v === "all" ? "All statuses" : v)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_CLASSES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!isLoading && selectedEnvironment && data?.meta.total === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={SearchX}
            title="No matching requests"
            description="No requests match the selected filters. Try a different method or status."
            action={{ label: "Clear filters", onClick: clearFilters }}
            className="py-16"
          />
        ) : (
          <EmptyState
            icon={Route}
            title="No requests yet"
            description={
              primaryHostname
                ? `Traffic to ${primaryHostname} will show up here.`
                : "Traffic to this environment will show up here once it's reachable."
            }
            className="py-16"
          />
        )
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          isLoading={isLoading || !selectedEnvironment}
          totalCount={data?.meta.total ?? 0}
          pageSize={PAGE_SIZE}
          pageIndex={pageIndex}
          onPageChange={setPageIndex}
        />
      )}
    </div>
  );
}
