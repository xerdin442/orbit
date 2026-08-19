"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SectionCard } from "@/components/shared/section-card";
import { Skeleton } from "@/components/shared/skeleton";
import { CopyToClipboardButton } from "@/components/shared/copy-to-clipboard-button";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  const [confirmingRotate, setConfirmingRotate] = useState(false);
  const [isRotating, setIsRotating] = useState(false);

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

  const handleRotateToken = async () => {
    setIsRotating(true);
    try {
      await api.projects.rotateToken(projectId);
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Project token rotated");
      setConfirmingRotate(false);
    } catch {
      // error toast already surfaced by the API client
    } finally {
      setIsRotating(false);
    }
  };

  if (isLoading || !project) {
    return <Skeleton className="h-40 w-full" />;
  }

  return (
    <>
      <SectionCard title="General">
      <div className="flex gap-10">
        <div className="flex-1 space-y-7">
          <div className="space-y-1.25">
            <label className="inline-block text-[13px] text-muted-foreground">
              Project name
            </label>
            <div className="flex max-w-sm items-center gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="min-w-0 flex-1"
              />
              <LoadingButton
                size="sm"
                loading={isSavingName}
                disabled={!name.trim() || name.trim() === project.name}
                onClick={handleSaveName}
                className="shrink-0"
              >
                Save
              </LoadingButton>
            </div>
          </div>

          <div className="space-y-1.25">
            <label className="inline-block text-[13px] text-muted-foreground">
              Project token
            </label>
            <div className="flex max-w-sm items-center gap-1">
              <span className="min-w-0 flex-1 truncate rounded-md border border-input bg-muted/10 px-2 py-1.5 font-mono text-sm text-foreground">
                {project.secretAccessToken}
              </span>
              <CopyToClipboardButton
                text={project.secretAccessToken}
                className="scale-120 shrink-0"
              />
              <Button
                size="sm"
                className="ml-1 shrink-0"
                onClick={() => setConfirmingRotate(true)}
              >
                Rotate
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-7">
          <div className="space-y-1.25">
            <label className="inline-block text-[13px] text-muted-foreground">
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
            <label className="inline-block text-[13px] text-muted-foreground">
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

      <ConfirmationDialog
        open={confirmingRotate}
        onOpenChange={(open) =>
          !open && !isRotating && setConfirmingRotate(false)
        }
        title="Rotate project token?"
        description="The current token will stop working immediately. Any CI/CD pipeline using it to trigger deployments will need to be updated with the new token."
        confirmLabel="Rotate Token"
        loading={isRotating}
        onConfirm={handleRotateToken}
        onCancel={() => !isRotating && setConfirmingRotate(false)}
      />
    </>
  );
}
