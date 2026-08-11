"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useUIStore } from "@/lib/store";
import { RepoCard } from "@/components/github/repo-card";
import { Skeleton } from "@/components/shared/skeleton";
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { useState } from "react";
import { toast } from "sonner";

export default function GitSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { selectedEnvironment, setSelectedEnvironment } = useUIStore();
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingBranch, setPendingBranch] = useState<string | null>(null);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api.projects.get(projectId),
  });

  const { data: branches, isLoading: branchesLoading } = useQuery({
    queryKey: ["project-branches", projectId],
    queryFn: () => api.projects.branches(projectId),
  });

  const { data: installations } = useQuery({
    queryKey: ["github", "installations"],
    queryFn: () => api.github.installations(),
    staleTime: 60_000,
  });

  const handleToggleConnection = async () => {
    if (!selectedEnvironment) return;
    const connecting = !selectedEnvironment.autoDeploy;
    setIsUpdating(true);
    try {
      const updated = await api.environments.update(
        projectId,
        selectedEnvironment.id,
        { autoDeploy: connecting },
      );
      setSelectedEnvironment(updated);
      queryClient.invalidateQueries({ queryKey: ["environments", projectId] });
      toast.success(
        connecting
          ? `Branch "${updated.branch}" is now connected for automatic deployments`
          : `Automatic deployments have been disabled for branch "${updated.branch}"`,
      );
    } catch {
      // error toast already surfaced by the API client
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConnectionButtonClick = () => {
    if (selectedEnvironment?.autoDeploy) {
      setConfirmingDisconnect(true);
    } else {
      void handleToggleConnection();
    }
  };

  const handleConfirmDisconnect = async () => {
    await handleToggleConnection();
    setConfirmingDisconnect(false);
  };

  const handleBranchSelect = (branch: string | null) => {
    if (!branch || branch === selectedEnvironment?.branch) return;
    setPendingBranch(branch);
  };

  const handleConfirmBranchChange = async () => {
    if (!selectedEnvironment || !pendingBranch || isUpdating) return;
    setIsUpdating(true);
    try {
      const updated = await api.environments.update(
        projectId,
        selectedEnvironment.id,
        { branch: pendingBranch },
      );
      setSelectedEnvironment(updated);
      queryClient.invalidateQueries({ queryKey: ["environments", projectId] });
      toast.success(`Branch changed to "${updated.branch}"`, {
        description: "A new deployment has been triggered.",
      });
    } catch {
      // error toast already surfaced by the API client
    } finally {
      setIsUpdating(false);
      setPendingBranch(null);
    }
  };

  const hasRepo = !!project?.source?.repositoryUrl;
  const loading = projectLoading || branchesLoading;

  const installationLogin =
    project?.source?.installationId != null
      ? (installations?.find(
          (i) => i.installationId === project.source!.installationId,
        )?.accountLogin ?? `#${project.source!.installationId}`)
      : "GitHub";

  if (loading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (!hasRepo) {
    return (
      <SectionCard title="Git Repository">
        <EmptyState
          title="No repository connected"
          description="Connect a GitHub repository to enable automatic deployments."
          className="py-10"
        />
      </SectionCard>
    );
  }

  return (
    <>
      <RepoCard
        repoUrl={project.source!.repositoryUrl}
        installationLogin={installationLogin}
        autoDeploy={selectedEnvironment?.autoDeploy ?? false}
        branches={branches ?? []}
        selectedBranch={
          pendingBranch ??
          selectedEnvironment?.branch ??
          branches?.[0]?.name ??
          "main"
        }
        isUpdating={isUpdating}
        onBranchChange={handleBranchSelect}
        onToggleConnection={handleConnectionButtonClick}
      />

      <ConfirmationDialog
        open={pendingBranch !== null}
        onOpenChange={(open) => !open && !isUpdating && setPendingBranch(null)}
        title="Change deployment branch?"
        description={
          pendingBranch
            ? `This environment will switch to deploy changes from "${pendingBranch}". A new deployment will be triggered immediately.`
            : ""
        }
        confirmLabel="Change branch"
        onConfirm={handleConfirmBranchChange}
        onCancel={() => !isUpdating && setPendingBranch(null)}
      />

      <ConfirmationDialog
        open={confirmingDisconnect}
        onOpenChange={(open) => !open && !isUpdating && setConfirmingDisconnect(false)}
        title="Disconnect repository?"
        description={`Automatic deployments will stop for branch "${selectedEnvironment?.branch ?? ""}". You can reconnect at any time.`}
        confirmLabel="Disconnect"
        variant="destructive"
        loading={isUpdating}
        onConfirm={handleConfirmDisconnect}
        onCancel={() => !isUpdating && setConfirmingDisconnect(false)}
      />
    </>
  );
}
