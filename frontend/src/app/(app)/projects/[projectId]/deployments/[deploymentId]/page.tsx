"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Box,
  Clock,
  GitCommitHorizontal,
  Radio,
} from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { TimestampDisplay } from "@/components/shared/timestamp-display";
import { TerminalViewer } from "@/components/shared/terminal-viewer";
import { KeyValueList } from "@/components/shared/key-value-list";
import { ActivityItem } from "@/components/shared/activity-item";
import { Skeleton } from "@/components/shared/skeleton";
import { Button } from "@/components/ui/button";
import { DeploymentTimeline } from "@/components/deployment/deployment-timeline";
import { RedeployButton } from "@/components/deployment/redeploy-button";
import { RollbackButton } from "@/components/deployment/rollback-button";
import { AbortButton } from "@/components/deployment/abort-button";
import { useSSE } from "@/hooks/use-sse";
import {
  buildStatusBadgeVariant,
  formatDuration,
  formatLogLine,
  isBuildInProgress,
  logLevelColor,
} from "@/lib/utils";
import type { DeploymentLog } from "@/lib/types";

const MOCK_MODE = process.env.NEXT_PUBLIC_MOCK_MODE === "true";

export default function DeploymentDetailPage() {
  const { projectId, deploymentId } = useParams<{
    projectId: string;
    deploymentId: string;
  }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [logs, setLogs] = useState<DeploymentLog[]>([]);
  const [seededLogsFor, setSeededLogsFor] = useState<string | null>(null);

  const { data: deployment, isLoading: deploymentLoading } = useQuery({
    queryKey: ["deployment", deploymentId],
    queryFn: () => api.deployments.get(deploymentId),
    refetchInterval: (query) => {
      const status = query.state.data?.buildStatus;
      return status && isBuildInProgress(status) ? 3000 : false;
    },
  });

  const { data: persistedLogs, isLoading: persistedLogsLoading } = useQuery({
    queryKey: ["deployment-logs", deploymentId],
    queryFn: () => api.deployments.logs(deploymentId),
  });

  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ["activity", { deploymentId }],
    queryFn: () => api.activity.list({ deploymentId }),
  });

  if (persistedLogs && seededLogsFor !== deploymentId) {
    setSeededLogsFor(deploymentId);
    setLogs(persistedLogs);
  }

  const isInProgress =
    !!deployment && isBuildInProgress(deployment.buildStatus);
  const streamUrl =
    isInProgress && !MOCK_MODE
      ? api.deployments.logsStreamUrl(deploymentId)
      : null;
  const { connected } = useSSE<DeploymentLog>(streamUrl, (entry) => {
    setLogs((prev) =>
      prev.some((l) => l.id === entry.id) ? prev : [...prev, entry],
    );
  });

  function handleChanged() {
    queryClient.invalidateQueries({ queryKey: ["deployment", deploymentId] });
    if (deployment) {
      queryClient.invalidateQueries({
        queryKey: ["deployments", deployment.environmentId],
      });
    }
    queryClient.invalidateQueries({ queryKey: ["activity", projectId] });
  }

  if (deploymentLoading || !deployment) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const isActive = deployment.lifecycleStatus === "active";
  const canRollback =
    deployment.lifecycleStatus === "inactive" ||
    deployment.buildStatus === "ready";

  return (
    <div>
      <PageHeader
        title={`Deployment: ${deployment.id}`}
        description={deployment.commitMessage ?? "No commit message"}
      >
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => router.push(`/projects/${projectId}/deployments`)}
        >
          <ArrowLeft className="size-3.5" />
          All deployments
        </Button>
      </PageHeader>

      <div className="space-y-6">
        <SectionCard
          title="Summary"
          actions={
            <div className="flex items-center gap-2">
              {isInProgress ? (
                <AbortButton
                  deploymentId={deployment.id}
                  onAborted={handleChanged}
                />
              ) : isActive ? (
                <RedeployButton
                  environmentId={deployment.environmentId}
                  commitSha={deployment.commitSha}
                  branch={deployment.environment?.branch ?? ""}
                  onRedeployed={handleChanged}
                />
              ) : (
                <RollbackButton
                  deploymentId={deployment.id}
                  commitSha={deployment.commitSha}
                  onRolledBack={(newId) =>
                    router.push(`/projects/${projectId}/deployments/${newId}`)
                  }
                  disabled={!canRollback}
                />
              )}
            </div>
          }
        >
          <div className="flex flex-wrap items-start gap-10">
            <div className="space-y-1.5">
              <p className="text-[0.8125rem] text-muted-foreground">Status</p>
              <StatusBadge
                variant={buildStatusBadgeVariant(deployment.buildStatus)}
              >
                {deployment.buildStatus}
              </StatusBadge>
            </div>

            <div className="space-y-1.5">
              <p className="text-[0.8125rem] text-muted-foreground">Trigger</p>
              <p className="text-[0.8125rem] text-foreground font-mono">
                {deployment.trigger}
              </p>
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center gap-1.25 text-[0.8125rem] text-muted-foreground">
                <GitCommitHorizontal className="size-3.5" />
                <span>Branch</span>
              </div>
              <p className="ml-0.5 inline-flex items-center rounded-md bg-muted border border-white/10 px-1.5 py-px text-xs font-medium font-mono text-foreground">
                {deployment.environment?.branch ?? "—"}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.25 text-[0.8125rem] text-muted-foreground">
                <Clock className="size-3" />
                <span>Created</span>
              </div>
              <TimestampDisplay
                value={deployment.createdAt}
                className="text-sm text-foreground"
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-[0.8125rem] text-muted-foreground">Duration</p>
              <p className="text-sm text-foreground">
                {formatDuration(deployment.createdAt, deployment.completedAt)}
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Timeline">
          <DeploymentTimeline
            buildStatus={deployment.buildStatus}
            failedStage={deployment.failedStage}
          />
        </SectionCard>

        <SectionCard
          title="Logs"
          actions={
            isInProgress && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground pr-2">
                <Radio
                  className={
                    connected
                      ? "size-3.5 text-green-500 animate-pulse"
                      : "size-3.5"
                  }
                />
                {connected ? "Live" : "Connecting..."}
              </div>
            )
          }
        >
          <TerminalViewer
            lines={
              persistedLogsLoading
                ? [
                    {
                      text: "Threading logs...",
                      className: "text-muted-foreground animate-pulse",
                    },
                  ]
                : logs.map((log) => ({
                    text: formatLogLine(log),
                    className: logLevelColor(log.level),
                  }))
            }
            className="h-96"
          />
        </SectionCard>

        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="Container Details">
            <KeyValueList
              items={[
                {
                  key: "Commit SHA",
                  value: deployment.commitSha.slice(0, 7) || "—",
                },
                {
                  key: "Image Tag",
                  value: deployment.imageTag ?? "Not built yet",
                },
                {
                  key: "Container ID",
                  value: deployment.containerId
                    ? deployment.containerId.slice(0, 12)
                    : "Not running",
                },
              ]}
            />
            {!deployment.containerId && !deployment.imageTag && (
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Box className="size-3.5" />
                No container has been created for this deployment yet.
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Activity"
            actions={
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() =>
                  router.push(`/activity?deploymentId=${deploymentId}`)
                }
              >
                View all
              </Button>
            }
          >
            {activityLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : activity && activity.data.length > 0 ? (
              <div className="space-y-3">
                {activity.data.slice(0, 3).map((a) => (
                  <ActivityItem key={a.id} activity={a} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
