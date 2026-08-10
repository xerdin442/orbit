"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  DatabaseX,
  Eye,
  EyeOff,
  Loader2,
  Table2,
  LaptopMinimal,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { TimestampDisplay } from "@/components/shared/timestamp-display";
import { CopyToClipboardButton } from "@/components/shared/copy-to-clipboard-button";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/shared/skeleton";
import { Button } from "@/components/ui/button";
import { DeleteResourceDialog } from "@/components/resource/delete-resource-dialog";
import { ClearResourceDialog } from "@/components/resource/clear-resource-dialog";
import { ResourceTableData } from "@/components/resource/resource-table-data";
import {
  cn,
  maskValue,
  RESOURCE_TYPE_LABELS,
  supportsWorkbench,
} from "@/lib/utils";

const TABS = ["overview", "tables", "settings"] as const;
type Tab = (typeof TABS)[number];

function ProvisioningIcon({ className }: { className?: string }) {
  return <Loader2 className={cn(className, "animate-spin")} />;
}

const PAGE_SIZE = 20;

export default function ResourceDetailPage() {
  const { projectId, resourceId } = useParams<{
    projectId: string;
    resourceId: string;
  }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>("overview");
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tablePage, setTablePage] = useState(0);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const { data: resource, isLoading } = useQuery({
    queryKey: ["resource", resourceId],
    queryFn: () => api.resources.get(resourceId),
  });

  const workbenchSupported = !!resource && supportsWorkbench(resource.type);
  const tablesTabVisible = !!resource && resource.status !== "unhealthy";
  const visibleTabs = TABS.filter((t) => t !== "tables" || tablesTabVisible);

  const { data: tablesResponse, isLoading: tablesLoading } = useQuery({
    queryKey: ["workbench", "tables", resourceId],
    queryFn: () => api.workbench.tables(resourceId),
    enabled: workbenchSupported && resource?.status === "ready",
  });
  const tables = tablesResponse?.tables ?? [];

  const { data: tableData, isLoading: tableDataLoading } = useQuery({
    queryKey: ["workbench", "table-data", resourceId, selectedTable, tablePage],
    queryFn: () =>
      api.workbench.tableData(resourceId, selectedTable as string, {
        page: tablePage + 1,
        limit: PAGE_SIZE,
      }),
    enabled: !!selectedTable,
  });

  const toggleReveal = (key: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectTable = (name: string) => {
    setSelectedTable(name);
    setTablePage(0);
  };

  if (isLoading || !resource) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const credentials = resource.credentials
    ? Object.entries(resource.credentials)
    : [];
  const ports = resource.ports ? Object.keys(resource.ports) : [];

  return (
    <div>
      <PageHeader title={resource.name}>
        {workbenchSupported && resource.status === "ready" && (
          <Button
            size="sm"
            disabled={tables.length <= 0}
            onClick={() =>
              router.push(
                `/projects/${projectId}/resources/${resourceId}/workbench`,
              )
            }
          >
            <LaptopMinimal className="size-3.75" />
            Open Workbench
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => router.push(`/projects/${projectId}/resources`)}
        >
          <ArrowLeft className="size-3.5" />
          All resources
        </Button>
      </PageHeader>

      <div className="mb-6 border-b border-border">
        <nav className="flex items-center gap-1">
          {visibleTabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "-mb-px border-b-2 border-transparent cursor-pointer px-3 py-2 text-sm font-medium capitalize text-muted-foreground transition-colors hover:text-foreground",
                tab === t && "border-primary text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          <SectionCard title="Overview">
            <div className="grid grid-cols-3 gap-5 sm:grid-cols-6">
              <div className="space-y-1.5">
                <p className="text-[0.8125rem] text-muted-foreground">Status</p>
                <StatusBadge variant={resource.status}>
                  {resource.status}
                </StatusBadge>
              </div>
              <div className="space-y-1.5">
                <p className="text-[0.8125rem] text-muted-foreground">Type</p>
                <p className="text-sm text-foreground">
                  {RESOURCE_TYPE_LABELS[resource.type]}
                </p>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <p className="text-[0.8125rem] text-muted-foreground">
                  Hostname
                </p>
                <p className="truncate font-mono text-sm text-foreground">
                  {resource.hostname ?? "—"}
                </p>
              </div>
              {ports.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[0.8125rem] text-muted-foreground">Port</p>
                  <p className="font-mono text-sm text-foreground">
                    {ports[0]}
                  </p>
                </div>
              )}
              <div className="space-y-1.5">
                <p className="text-[0.8125rem] text-muted-foreground">
                  Created
                </p>
                <TimestampDisplay
                  value={resource.createdAt}
                  className="text-sm text-foreground"
                />
              </div>
            </div>
          </SectionCard>

          {credentials.length > 0 && (
            <SectionCard
              title="Connection Variables"
              description="Injected automatically into your application container."
            >
              <div className="space-y-2">
                {credentials.map(([key, value]) => {
                  const isRevealed = revealed.has(key);
                  return (
                    <div key={key} className="flex items-center gap-2 text-xs">
                      <span className="w-40 shrink-0 truncate font-mono text-muted-foreground">
                        {key}
                      </span>
                      <span className="flex-1 truncate font-mono text-foreground">
                        {isRevealed ? value : maskValue(value)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => toggleReveal(key)}
                      >
                        {isRevealed ? (
                          <EyeOff className="size-3.5" />
                        ) : (
                          <Eye className="size-3.5" />
                        )}
                      </Button>
                      <CopyToClipboardButton text={value} />
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {tab === "tables" &&
        tablesTabVisible &&
        (resource.status === "provisioning" ? (
          <EmptyState
            icon={ProvisioningIcon}
            title="Preparing table data"
            description="This resource is still provisioning. Table data will be available once it's ready."
            className="py-16"
          />
        ) : !workbenchSupported ? (
          <EmptyState
            icon={Table2}
            title="Not supported"
            description={`Table browsing is not supported for ${RESOURCE_TYPE_LABELS[resource.type]} resources.`}
            className="py-16"
          />
        ) : (
          <div className="grid grid-cols-[200px_1fr] gap-4">
            <div className="space-y-1 rounded-lg border border-border p-2">
              {tablesLoading && <Skeleton className="h-8 w-full" />}
              {!tablesLoading && tables.length === 0 && (
                <p className="pl-2 pt-3 text-[0.8125rem] text-muted-foreground">
                  No tables found.
                </p>
              )}
              {tables.map((t) => (
                <button
                  key={t.name}
                  onClick={() => selectTable(t.name)}
                  className={cn(
                    "w-full truncate cursor-pointer rounded-md px-2 py-1.5 text-left font-mono font-medium text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    selectedTable === t.name && "bg-muted text-foreground",
                  )}
                >
                  {t.name}
                </button>
              ))}
            </div>

            <div className="min-w-0">
              {!selectedTable ? (
                <EmptyState
                  icon={Table2}
                  title="Select a table"
                  description="Choose a table from the list to browse its data."
                  className="py-16"
                />
              ) : (
                <ResourceTableData
                  columns={tableData?.columns ?? []}
                  rows={tableData?.rows ?? []}
                  isLoading={tableDataLoading}
                  pagination={{
                    totalCount: tableData?.meta.total ?? 0,
                    pageSize: PAGE_SIZE,
                    pageIndex: tablePage,
                    onPageChange: setTablePage,
                  }}
                />
              )}
            </div>
          </div>
        ))}

      {tab === "settings" && (
        <div className="grid gap-6 sm:grid-cols-2">
          <SectionCard
            title="Data Reset"
            description="Clear all the data in this resource and re-provision the container."
          >
            <Button
              variant="outline"
              onClick={() => setClearConfirmOpen(true)}
              disabled={resource.status === "provisioning"}
            >
              <DatabaseX className="size-3.5" />
              Clear Data
            </Button>
          </SectionCard>

          <SectionCard
            title="Danger Zone"
            description="Permanently delete this resource and all of its data."
          >
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="size-3.5" />
              Delete Resource
            </Button>
          </SectionCard>
        </div>
      )}

      <DeleteResourceDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        resource={resource}
        onDeleted={() => router.push(`/projects/${projectId}/resources`)}
      />

      <ClearResourceDialog
        open={clearConfirmOpen}
        onOpenChange={setClearConfirmOpen}
        resource={resource}
        onCleared={() =>
          queryClient.invalidateQueries({ queryKey: ["resource", resourceId] })
        }
      />
    </div>
  );
}
