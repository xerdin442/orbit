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
import { buildDirectorySchema } from "@/lib/schema";

export default function GeneralSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [buildDirectory, setBuildDirectory] = useState("");
  const [isSavingBuildDirectory, setIsSavingBuildDirectory] = useState(false);
  const [startCommand, setStartCommand] = useState("");
  const [isSavingStartCommand, setIsSavingStartCommand] = useState(false);
  const [seededFor, setSeededFor] = useState<string | null>(null);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api.projects.get(projectId),
  });

  if (project && seededFor !== project.id) {
    setSeededFor(project.id);
    setName(project.name);
    setBuildDirectory(project.buildDirectory ?? "");
    setStartCommand(project.startCommand ?? "");
  }

  const buildDirectoryError =
    buildDirectorySchema.safeParse(buildDirectory).error?.issues[0]?.message;

  const handleSaveName = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === project?.name) return;

    setIsSavingName(true);
    try {
      await api.projects.update(projectId, { name: trimmed });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project name updated");
    } catch {
      // error toast already surfaced by the API client
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSaveBuildDirectory = async () => {
    const trimmed = buildDirectory.trim();
    if (buildDirectoryError || trimmed === (project?.buildDirectory ?? ""))
      return;

    setIsSavingBuildDirectory(true);
    try {
      await api.projects.update(projectId, { buildDirectory: trimmed });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Build directory updated");
    } catch {
      // error toast already surfaced by the API client
    } finally {
      setIsSavingBuildDirectory(false);
    }
  };

  const handleSaveStartCommand = async () => {
    const trimmed = startCommand.trim();
    if (trimmed === (project?.startCommand ?? "")) return;

    setIsSavingStartCommand(true);
    try {
      await api.projects.update(projectId, { startCommand: trimmed });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Start command updated");
    } catch {
      // error toast already surfaced by the API client
    } finally {
      setIsSavingStartCommand(false);
    }
  };

  if (isLoading || !project) {
    return <Skeleton className="h-40 w-full" />;
  }

  return (
    <SectionCard title="General">
      <div className="flex gap-12">
        <div className="flex-1 space-y-4">
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
                loading={isSavingName}
                disabled={!name.trim() || name.trim() === project.name}
                onClick={handleSaveName}
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

        <div className="flex-1 space-y-4">
          <div className="space-y-1.25">
            <label className="inline-block text-xs text-muted-foreground">
              Build directory
            </label>
            <div className="flex items-center gap-2">
              <Input
                value={buildDirectory}
                onChange={(e) => setBuildDirectory(e.target.value)}
                placeholder="e.g. apps/web"
                className="max-w-sm font-mono"
              />
              <LoadingButton
                size="sm"
                loading={isSavingBuildDirectory}
                disabled={
                  !!buildDirectoryError ||
                  buildDirectory.trim() === (project.buildDirectory ?? "")
                }
                onClick={handleSaveBuildDirectory}
              >
                Save
              </LoadingButton>
            </div>
            {buildDirectoryError && (
              <p className="text-xs text-destructive">{buildDirectoryError}</p>
            )}
          </div>

          <div className="space-y-1.25">
            <label className="inline-block text-xs text-muted-foreground">
              Start command
            </label>
            <div className="flex items-center gap-2">
              <Input
                value={startCommand}
                onChange={(e) => setStartCommand(e.target.value)}
                placeholder="Auto-detected if left blank"
                className="max-w-sm font-mono"
              />
              <LoadingButton
                size="sm"
                loading={isSavingStartCommand}
                disabled={startCommand.trim() === (project.startCommand ?? "")}
                onClick={handleSaveStartCommand}
              >
                Save
              </LoadingButton>
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
