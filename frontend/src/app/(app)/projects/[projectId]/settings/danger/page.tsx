"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SectionCard } from "@/components/shared/section-card";
import { Skeleton } from "@/components/shared/skeleton";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { api } from "@/lib/api";

export default function DangerZoneSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api.projects.get(projectId),
  });

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await api.projects.delete(projectId);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(`Project "${project?.name}" deleted`);
      router.push("/projects");
    } catch {
      setIsDeleting(false);
    }
  };

  if (isLoading || !project) {
    return <Skeleton className="h-40 w-full" />;
  }

  return (
    <>
      <SectionCard title="Danger Zone">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">
              Delete this project
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Permanently deletes the project and everything in it, including
              environments, resources, and deployment history. This cannot be
              undone.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="shrink-0"
            onClick={() => setConfirmingDelete(true)}
          >
            Delete Project
          </Button>
        </div>
      </SectionCard>

      <ConfirmationDialog
        open={confirmingDelete}
        onOpenChange={(open) =>
          !open && !isDeleting && setConfirmingDelete(false)
        }
        title="Delete project?"
        description={`This will permanently delete "${project.name}" and everything in it, including environments, resources, and deployment history. This cannot be undone.`}
        confirmLabel="Delete Project"
        variant="destructive"
        requiresTyping={project.name}
        loading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => !isDeleting && setConfirmingDelete(false)}
      />
    </>
  );
}
