"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SectionCard } from "@/components/shared/section-card";
import { Skeleton } from "@/components/shared/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { EnvironmentDialog } from "@/components/environment/environment-dialog";
import { api } from "@/lib/api";
import type { Environment } from "@/lib/types";

export default function EnvironmentsSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const [dialogEnvironment, setDialogEnvironment] = useState<
    Environment | null | undefined
  >(undefined);
  const [deletingEnvironment, setDeletingEnvironment] =
    useState<Environment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: environments, isLoading } = useQuery({
    queryKey: ["environments", projectId],
    queryFn: () => api.environments.list(projectId),
  });

  const handleDelete = async () => {
    if (!deletingEnvironment) return;
    setIsDeleting(true);
    try {
      await api.environments.delete(projectId, deletingEnvironment.id);
      queryClient.invalidateQueries({ queryKey: ["environments", projectId] });
      toast.success(`Environment "${deletingEnvironment.name}" deleted`);
      setDeletingEnvironment(null);
    } catch {
      // error toast already surfaced by the API client
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <SectionCard
        title="Environments"
        actions={
          <Button size="sm" onClick={() => setDialogEnvironment(null)}>
            <Plus className="size-3.5" />
            New Environment
          </Button>
        }
      >
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : !environments || environments.length === 0 ? (
          <EmptyState
            title="No environments"
            description="Create an environment to start deploying a branch."
            className="py-10"
          />
        ) : (
          <div className="divide-y divide-border">
            {environments.map((env) => (
              <div
                key={env.id}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {env.name}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      {env.branch}
                    </p>
                  </div>
                  <StatusBadge
                    variant={env.autoDeploy ? "ready" : "inactive"}
                    className="text-[0.6875rem] px-1.5 py-px font-mono uppercase shrink-0"
                  >
                    {env.autoDeploy ? "Auto-deploy" : "Manual"}
                  </StatusBadge>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDialogEnvironment(env)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDeletingEnvironment(env)}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <EnvironmentDialog
        open={dialogEnvironment !== undefined}
        onOpenChange={(open) => !open && setDialogEnvironment(undefined)}
        projectId={projectId}
        environment={dialogEnvironment}
      />

      <ConfirmationDialog
        open={!!deletingEnvironment}
        onOpenChange={(open) =>
          !open && !isDeleting && setDeletingEnvironment(null)
        }
        title="Delete environment?"
        description={
          deletingEnvironment
            ? `This will permanently delete "${deletingEnvironment.name}" and its resources, variables, and deployment history. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete Environment"
        variant="destructive"
        requiresTyping={deletingEnvironment?.name ?? null}
        loading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => !isDeleting && setDeletingEnvironment(null)}
      />
    </>
  );
}
