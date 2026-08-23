"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { TimestampDisplay } from "@/components/shared/timestamp-display";
import { Skeleton } from "@/components/shared/skeleton";
import { useUIStore } from "@/lib/store";
import { useEffect, useMemo } from "react";
import {
  Activity,
  GitCommitHorizontal,
  Link as LinkIcon,
  Terminal,
  Clock,
  Globe,
  Dot,
} from "lucide-react";
import { CopyToClipboardButton } from "@/components/shared/copy-to-clipboard-button";
import { ActivityItem } from "@/components/shared/activity-item";
import { Button } from "@/components/ui/button";
import { RedeployButton } from "@/components/deployment/redeploy-button";
import { RollbackButton } from "@/components/deployment/rollback-button";
import { DeploymentLogsDialog } from "@/components/deployment/deployment-logs-dialog";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import Link from "next/link";
import { useSelectedEnvironment } from "@/hooks/use-selected-environment";
import { useDialog } from "@/hooks/use-dialog";
import { buildStatusBadgeVariant } from "@/lib/utils";

export default function ProjectOverviewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setSelectedProject } = useUIStore();
  const { selectedEnvironment } = useSelectedEnvironment(projectId);
  const logsDialog = useDialog();

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api.projects.get(projectId),
  });

  const { data: deployments, isLoading: deploymentsLoading } = useQuery({
    queryKey: ["deployments", selectedEnvironment?.id],
    queryFn: () =>
      selectedEnvironment
        ? api.deployments.listByEnvironment(selectedEnvironment.id)
        : null,
    enabled: !!selectedEnvironment,
  });

  const { data: domains } = useQuery({
    queryKey: ["domains", selectedEnvironment?.id],
    queryFn: () =>
      selectedEnvironment ? api.domains.list(selectedEnvironment.id) : null,
    enabled: !!selectedEnvironment,
  });

  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ["activity", projectId],
    queryFn: () => api.activity.list({ projectId }),
  });

  useEffect(() => {
    if (project) setSelectedProject(project);
  }, [project, setSelectedProject]);

  const latestDeployment = deployments?.data?.[0];
  const previousDeployment = deployments?.data?.[1];
  const canRollbackToPrevious =
    !!previousDeployment &&
    (previousDeployment.lifecycleStatus === "inactive" ||
      previousDeployment.buildStatus === "ready");

  const repoName = project?.source?.repositoryUrl.replace(
    "https://github.com/",
    "",
  );

  const displayDomain = useMemo(() => {
    if (!domains || domains.length === 0) return null;
    const customDomains = domains.filter((d) => d.type === "custom");
    if (customDomains.length > 0) {
      return customDomains.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0];
    }
    return domains.find((d) => d.type === "managed") ?? domains[0];
  }, [domains]);

  function handleDeploymentChanged() {
    queryClient.invalidateQueries({
      queryKey: ["deployments", selectedEnvironment?.id],
    });
    queryClient.invalidateQueries({ queryKey: ["activity", projectId] });
  }

  if (!projectId) return null;

  return (
    <div>
      <PageHeader title={project?.name ?? "Overview"} />

      {!project && (
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {project && (
        <div className="space-y-6">
          <div className="space-y-2">
            {repoName && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FontAwesomeIcon icon={faGithub} className="shrink-0" />
                <span className="truncate">{repoName}</span>
                {selectedEnvironment?.branch && (
                  <span className="ml-1 inline-flex items-center rounded-md bg-muted border border-white/10 px-1.5 py-0.5 text-xs font-medium font-mono text-muted-foreground">
                    {selectedEnvironment.branch}
                  </span>
                )}
              </div>
            )}

            {latestDeployment ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <GitCommitHorizontal className="size-4 shrink-0" />
                <span className="font-mono text-xs">
                  [{latestDeployment.commitSha.slice(0, 7)}]
                </span>
                <span className="truncate">
                  {latestDeployment.commitMessage ?? "No commit message"}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <GitCommitHorizontal className="size-4 shrink-0" />
                <span>No deployments yet</span>
              </div>
            )}

            {displayDomain && (
              <div className="flex items-center gap-1.5">
                <Link
                  href={`https://${displayDomain.hostname}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <LinkIcon className="size-3.5 shrink-0" />
                  <span className="truncate underline underline-offset-2 hover:text-primary/60 transition-colors">
                    {displayDomain.hostname}
                  </span>
                </Link>
                <CopyToClipboardButton
                  text={`https://${displayDomain.hostname}`}
                  className="h-5 w-5"
                />
              </div>
            )}
          </div>

          <SectionCard
            title="Latest Deployment"
            description={selectedEnvironment?.name}
            actions={
              latestDeployment && (
                <div className="flex items-center gap-2.5">
                  <RedeployButton
                    environmentId={latestDeployment.environmentId}
                    commitSha={latestDeployment.commitSha}
                    branch={selectedEnvironment?.branch ?? ""}
                    onRedeployed={handleDeploymentChanged}
                    className="text-xs"
                  />
                  {previousDeployment && (
                    <RollbackButton
                      deploymentId={previousDeployment.id}
                      commitSha={previousDeployment.commitSha}
                      onRolledBack={handleDeploymentChanged}
                      disabled={!canRollbackToPrevious}
                      className="text-xs"
                    />
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={logsDialog.open}
                  >
                    <Terminal className="size-3.5" />
                    View Logs
                  </Button>
                </div>
              )
            }
          >
            {latestDeployment ? (
              <div className="flex items-start gap-12">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.25 text-[0.8125rem] text-muted-foreground">
                    <Activity className="size-3.5" />
                    <span>Status</span>
                  </div>
                  <StatusBadge
                    variant={buildStatusBadgeVariant(
                      latestDeployment.buildStatus,
                    )}
                  >
                    {latestDeployment.buildStatus}
                  </StatusBadge>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.25 text-[0.8125rem] text-muted-foreground">
                    <Clock className="size-3.5" />
                    <span>Created</span>
                  </div>
                  <TimestampDisplay
                    value={latestDeployment.createdAt}
                    className="text-sm text-foreground"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.25 text-[0.8125rem] text-muted-foreground">
                    <Globe className="size-3.5" />
                    <span>Domains</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-foreground">
                    <span>
                      {domains?.filter((d) => d.status === "active").length ??
                        0}{" "}
                      configured
                    </span>
                    <Dot size={12} />
                    <Link
                      href={`/projects/${projectId}/domains`}
                      className="text-xs text-primary hover:underline"
                    >
                      See details
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No deployments yet for this environment.
              </p>
            )}
          </SectionCard>

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard
              title="Recent Activity"
              actions={
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() =>
                    router.push(`/activity?projectId=${projectId}`)
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
                  {activity.data.slice(0, 5).map((a) => (
                    <ActivityItem key={a.id} activity={a} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No recent activity.
                </p>
              )}
            </SectionCard>

            <SectionCard
              title="Recent Deployments"
              actions={
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() =>
                    router.push(`/projects/${projectId}/deployments`)
                  }
                >
                  View all
                </Button>
              }
            >
              {deploymentsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : deployments?.data && deployments.data.length > 0 ? (
                <div className="space-y-3">
                  {deployments.data.slice(0, 5).map((d) => (
                    <Link
                      key={d.id}
                      href={`/projects/${projectId}/deployments/${d.id}`}
                      className="grid grid-cols-[auto_1fr_auto] items-center gap-3 text-sm border-b border-border last:border-b-0 pb-3 last:pb-0 hover:text-foreground transition-colors"
                    >
                      <StatusBadge
                        variant={buildStatusBadgeVariant(d.buildStatus)}
                      >
                        {d.buildStatus}
                      </StatusBadge>
                      <span className="text-foreground truncate">
                        {d.commitMessage ?? d.commitSha.slice(0, 7)}
                      </span>
                      <TimestampDisplay
                        value={d.createdAt}
                        className="text-xs shrink-0"
                      />
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No deployments yet.
                </p>
              )}
            </SectionCard>
          </div>
        </div>
      )}

      {latestDeployment && (
        <DeploymentLogsDialog
          open={logsDialog.isOpen}
          onOpenChange={logsDialog.setIsOpen}
          projectId={projectId}
          deploymentId={latestDeployment.id}
          buildStatus={latestDeployment.buildStatus}
        />
      )}
    </div>
  );
}
