"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Rocket } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { TimestampDisplay } from "@/components/shared/timestamp-display";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RedeployButton } from "@/components/deployment/redeploy-button";
import { RollbackButton } from "@/components/deployment/rollback-button";
import { AbortButton } from "@/components/deployment/abort-button";
import { useSelectedEnvironment } from "@/hooks/use-selected-environment";
import {
  buildStatusBadgeVariant,
  formatDuration,
  isBuildInProgress,
} from "@/lib/utils";
import { toast } from "sonner";
import type { Deployment } from "@/lib/types";

const PAGE_SIZE = 20;

export default function DeploymentsListPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { selectedEnvironment } = useSelectedEnvironment(projectId);
  const [pageIndex, setPageIndex] = useState(0);
  const [deploying, setDeploying] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["deployments", selectedEnvironment?.id, pageIndex],
    queryFn: () =>
      selectedEnvironment
        ? api.deployments.listByEnvironment(selectedEnvironment.id, {
            page: pageIndex + 1,
            limit: PAGE_SIZE,
          })
        : null,
    enabled: !!selectedEnvironment,
  });

  function handleChanged() {
    queryClient.invalidateQueries({
      queryKey: ["deployments", selectedEnvironment?.id],
    });
    queryClient.invalidateQueries({ queryKey: ["activity", projectId] });
  }

  async function handleDeploy() {
    if (!selectedEnvironment) return;
    setDeploying(true);
    try {
      const { deploymentId } = await api.environments.deploy(
        selectedEnvironment.id,
        0,
      );
      toast.success("Deployment triggered");
      router.push(`/projects/${projectId}/deployments/${deploymentId}`);
    } catch {
      // error toast already surfaced by the API client
    } finally {
      setDeploying(false);
    }
  }

  const columns: ColumnDef<Deployment>[] = [
    {
      accessorKey: "buildStatus",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge
          variant={buildStatusBadgeVariant(row.original.buildStatus)}
        >
          {row.original.buildStatus}
        </StatusBadge>
      ),
    },
    {
      accessorKey: "commitSha",
      header: "Commit",
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.commitSha ? row.original.commitSha.slice(0, 7) : "—"}
          </span>
          <span className="max-w-60 truncate text-sm text-foreground">
            {row.original.commitMessage ?? "No commit message"}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "trigger",
      header: "Trigger",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground font-mono tracking-[-0.015em]">
          {row.original.trigger}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => <TimestampDisplay value={row.original.createdAt} />,
    },
    {
      id: "duration",
      header: "Duration",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDuration(row.original.createdAt, row.original.completedAt)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const d = row.original;
        const isActive = d.lifecycleStatus === "active";
        const canRollback =
          d.lifecycleStatus === "inactive" || d.buildStatus === "ready";

        return (
          <div className="flex items-center justify-end gap-2">
            {isBuildInProgress(d.buildStatus) ? (
              <AbortButton deploymentId={d.id} onAborted={handleChanged} />
            ) : isActive ? (
              <RedeployButton
                environmentId={d.environmentId}
                commitSha={d.commitSha}
                branch={selectedEnvironment?.branch ?? ""}
                onRedeployed={handleChanged}
              />
            ) : (
              <RollbackButton
                deploymentId={d.id}
                commitSha={d.commitSha}
                onRolledBack={handleChanged}
                disabled={!canRollback}
              />
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() =>
                        router.push(
                          `/projects/${projectId}/deployments/${d.id}`,
                        )
                      }
                    >
                      <Eye className="size-3.5" />
                    </Button>
                  }
                />
                <TooltipContent>Inspect deployment</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader title="Deployments" />

      {data && data.data.length === 0 ? (
        <EmptyState
          icon={Rocket}
          title="No deployments yet"
          description="Deploy your first version to get started."
          action={{
            label: deploying ? "Deploying..." : "Deploy",
            onClick: handleDeploy,
          }}
          className="py-16"
        />
      ) : (
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          isLoading={isLoading || !selectedEnvironment}
          totalCount={data?.meta.total ?? 0}
          pageSize={PAGE_SIZE}
          pageIndex={pageIndex}
          onPageChange={setPageIndex}
          emptyMessage="No deployments found."
        />
      )}
    </div>
  );
}
