"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useUIStore } from "@/lib/store";
import { InstallationList } from "@/components/github/installation-list";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import type { GitHubInstallation } from "@/lib/types";

export function GitInstallationsSection() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { selectedProject, setSelectedProject } = useUIStore();
  const [removing, setRemoving] = useState<GitHubInstallation | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const {
    data: installations,
    isLoading: installationsLoading,
    isError: installationsError,
  } = useQuery({
    queryKey: ["github", "installations"],
    queryFn: () => api.github.installations(),
  });

  const handleConnect = async () => {
    const url = await api.github.installUrl();
    window.location.href = url;
  };

  const handleConfirmRemove = async () => {
    if (!removing || isRemoving) return;

    setIsRemoving(true);
    try {
      await api.github.remove(removing.installationId);
      toast.success(
        `Orbit app successfully uninstalled from "${removing.accountLogin}"`,
      );
      queryClient.invalidateQueries({ queryKey: ["github", "installations"] });

      if (selectedProject?.source?.installationId === removing.installationId) {
        const remaining = await api.projects.list();
        if (remaining.length > 0) {
          setSelectedProject(remaining[0]);
        } else {
          setSelectedProject(null);
          router.push("/projects");
        }
      }

      setRemoving(null);
    } catch {
      // error toast already surfaced by the API client
    } finally {
      setIsRemoving(false);
    }
  };

  const handleRetryInstallations = () => {
    queryClient.invalidateQueries({ queryKey: ["github", "installations"] });
  };

  return (
    <>
      <InstallationList
        installations={installations}
        isLoading={installationsLoading}
        isError={installationsError}
        onConnect={handleConnect}
        onRemove={setRemoving}
        onRetry={handleRetryInstallations}
      />

      <ConfirmationDialog
        open={!!removing}
        onOpenChange={(open) => !open && !isRemoving && setRemoving(null)}
        title="Remove GitHub installation?"
        description={`This will uninstall the Orbit app from "${removing?.accountLogin}" and permanently delete every project connected through it, including their environments, deployments, and resources. This cannot be undone.`}
        confirmLabel={isRemoving ? "Removing..." : "Remove"}
        variant="destructive"
        requiresTyping={removing?.accountLogin ?? null}
        loading={isRemoving}
        onConfirm={handleConfirmRemove}
        onCancel={() => setRemoving(null)}
      />
    </>
  );
}
