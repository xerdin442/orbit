"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useUIStore } from "@/lib/store";
import { RepoCard } from "@/components/github/repo-card";
import { Skeleton } from "@/components/shared/skeleton";
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState } from "@/components/shared/empty-state";
import { useState } from "react";

export default function GitSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { selectedEnvironment, setSelectedEnvironment } = useUIStore();
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState(false);

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
    setIsUpdating(true);
    try {
      const updated = await api.environments.update(selectedEnvironment.id, {
        autoDeploy: !selectedEnvironment.autoDeploy,
      });
      setSelectedEnvironment(updated);
      queryClient.invalidateQueries({ queryKey: ["environments", projectId] });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBranchChange = async (branch: string | null) => {
    if (!selectedEnvironment || !branch) return;
    setIsUpdating(true);
    try {
      const updated = await api.environments.update(selectedEnvironment.id, {
        branch,
      });
      setSelectedEnvironment(updated);
      queryClient.invalidateQueries({ queryKey: ["environments", projectId] });
    } finally {
      setIsUpdating(false);
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
    <RepoCard
      repoUrl={project.source!.repositoryUrl}
      installationLogin={installationLogin}
      autoDeploy={selectedEnvironment?.autoDeploy ?? false}
      branches={branches ?? []}
      selectedBranch={
        selectedEnvironment?.branch ?? branches?.[0]?.name ?? "main"
      }
      isUpdating={isUpdating}
      onBranchChange={handleBranchChange}
      onToggleConnection={handleToggleConnection}
    />
  );
}
