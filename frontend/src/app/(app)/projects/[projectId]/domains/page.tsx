"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Globe, NotebookPen, Plus, RefreshCw, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { AddDomainDialog } from "@/components/domain/add-domain-dialog";
import { DeleteDomainDialog } from "@/components/domain/delete-domain-dialog";
import { DomainInstructionsDialog } from "@/components/domain/domain-instructions-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSelectedEnvironment } from "@/hooks/use-selected-environment";
import { cn, domainSslLabel, domainSslVariant } from "@/lib/utils";
import type { Domain } from "@/lib/types";

const PAGE_SIZE = 10;

export default function DomainsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { selectedEnvironment } = useSelectedEnvironment(projectId);
  const queryClient = useQueryClient();

  const [pageIndex, setPageIndex] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<Domain | null>(null);
  const [viewingInstructions, setViewingInstructions] = useState<Domain | null>(
    null,
  );
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());

  const { data: domains, isLoading } = useQuery({
    queryKey: ["domains", selectedEnvironment?.id],
    queryFn: () =>
      selectedEnvironment ? api.domains.list(selectedEnvironment.id) : null,
    enabled: !!selectedEnvironment,
    staleTime: 15_000,
  });

  const invalidateDomains = () => {
    queryClient.invalidateQueries({
      queryKey: ["domains", selectedEnvironment?.id],
    });
  };

  const handleRefresh = async (id: string) => {
    setRefreshingIds((prev) => new Set(prev).add(id));
    try {
      const updated = await api.domains.get(id);
      queryClient.setQueryData<Domain[]>(
        ["domains", selectedEnvironment?.id],
        (prev) => prev?.map((d) => (d.id === id ? updated : d)),
      );
    } catch {
      // error toast already surfaced by the API client
    } finally {
      setRefreshingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const columns: ColumnDef<Domain>[] = [
    {
      accessorKey: "hostname",
      header: "Hostname",
      cell: ({ row }) => (
        <span className="font-mono text-foreground">
          {row.original.hostname}
        </span>
      ),
    },
    {
      id: "type",
      header: "Type",
      cell: ({ row }) => (
        <span className="text-muted-foreground capitalize">
          {row.original.type}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge variant={row.original.status}>
          {row.original.status}
        </StatusBadge>
      ),
    },
    {
      id: "ssl",
      header: "SSL",
      cell: ({ row }) => (
        <StatusBadge variant={domainSslVariant(row.original.status)}>
          {domainSslLabel(row.original.status)}
        </StatusBadge>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const refreshing = refreshingIds.has(row.original.id);
        const needsInstructions =
          row.original.status === "pending" ||
          row.original.status === "verifying";
        return (
          <TooltipProvider>
            <div className="flex items-center justify-end gap-1.5">
              {needsInstructions && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setViewingInstructions(row.original)}
                      >
                        <NotebookPen className="size-4" />
                      </Button>
                    }
                  />
                  <TooltipContent>View DNS instructions</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={refreshing}
                      onClick={() => handleRefresh(row.original.id)}
                    >
                      <RefreshCw
                        className={cn("size-4", refreshing && "animate-spin")}
                      />
                    </Button>
                  }
                />
                <TooltipContent>Refresh status</TooltipContent>
              </Tooltip>
              {row.original.type === "custom" && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        size="icon-sm"
                        onClick={() => setDeleting(row.original)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    }
                  />
                  <TooltipContent>Remove domain</TooltipContent>
                </Tooltip>
              )}
            </div>
          </TooltipProvider>
        );
      },
    },
  ];

  const pagedDomains = (domains ?? []).slice(
    pageIndex * PAGE_SIZE,
    pageIndex * PAGE_SIZE + PAGE_SIZE,
  );

  return (
    <div>
      <PageHeader title="Domains">
        {domains && domains.length > 0 && (
          <Button variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="size-3.5" />
            Add Domain
          </Button>
        )}
      </PageHeader>

      {!isLoading && selectedEnvironment && domains?.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="No domains yet"
          description="Add a custom domain to make this environment reachable over a network."
          action={{ label: "Add Domain", onClick: () => setAddOpen(true) }}
          className="py-16"
        />
      ) : (
        <DataTable
          columns={columns}
          data={pagedDomains}
          isLoading={isLoading || !selectedEnvironment}
          totalCount={domains?.length ?? 0}
          pageSize={PAGE_SIZE}
          pageIndex={pageIndex}
          onPageChange={setPageIndex}
        />
      )}

      {selectedEnvironment && (
        <>
          <AddDomainDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            environmentId={selectedEnvironment.id}
            onAdded={invalidateDomains}
          />
          <DeleteDomainDialog
            open={!!deleting}
            onOpenChange={(open) => !open && setDeleting(null)}
            domain={deleting}
            onDeleted={invalidateDomains}
          />
          <DomainInstructionsDialog
            open={!!viewingInstructions}
            onOpenChange={(open) => !open && setViewingInstructions(null)}
            domain={viewingInstructions}
          />
        </>
      )}
    </div>
  );
}
