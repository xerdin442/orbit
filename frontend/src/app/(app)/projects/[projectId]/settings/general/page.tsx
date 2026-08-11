"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SectionCard } from "@/components/shared/section-card";
import { Skeleton } from "@/components/shared/skeleton";
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/shared/loading-button";
import { api } from "@/lib/api";

export default function GeneralSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [nameSeededFor, setNameSeededFor] = useState<string | null>(null);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api.projects.get(projectId),
  });

  if (project && nameSeededFor !== project.id) {
    setNameSeededFor(project.id);
    setName(project.name);
  }

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === project?.name) return;

    setIsSaving(true);
    try {
      await api.projects.update(projectId, { name: trimmed });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project name updated");
    } catch {
      // error toast already surfaced by the API client
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !project) {
    return <Skeleton className="h-40 w-full" />;
  }

  return (
    <SectionCard title="General">
      <div className="space-y-4">
        <div className="space-y-1.25">
          <label className="inline-block text-xs text-muted-foreground">
            Project name
          </label>
          <div className="flex items-center gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="max-w-sm"
            />
            <LoadingButton
              size="sm"
              loading={isSaving}
              disabled={!name.trim() || name.trim() === project.name}
              onClick={handleSave}
            >
              Save
            </LoadingButton>
          </div>
        </div>

        <div className="space-y-1.25">
          <label className="inline-block text-xs text-muted-foreground">
            Default branch
          </label>
          <p className="text-sm text-foreground">
            {project.source?.defaultBranch ?? "—"}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}
