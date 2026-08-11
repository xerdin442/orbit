"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { LoadingButton } from "@/components/shared/loading-button";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { environmentNameSchema } from "@/lib/schema";
import type { Environment } from "@/lib/types";

interface EnvironmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  environment?: Environment | null;
}

export function EnvironmentDialog({
  open,
  onOpenChange,
  projectId,
  environment,
}: EnvironmentDialogProps) {
  const isEdit = !!environment;
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [branch, setBranch] = useState("");
  const [autoDeploy, setAutoDeploy] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);

  const { data: branches, isLoading: branchesLoading } = useQuery({
    queryKey: ["project-branches", projectId],
    queryFn: () => api.projects.branches(projectId),
    enabled: open,
  });

  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setName(environment?.name ?? "");
      setAutoDeploy(environment?.autoDeploy ?? true);
      setBranch(environment?.branch ?? "");
    }
  }

  if (!branch && branches && branches.length > 0) {
    setBranch(branches[0].name);
  }

  const trimmedName = name.trim();
  const nameValidation = trimmedName
    ? environmentNameSchema.safeParse(trimmedName)
    : null;
  const nameError =
    nameValidation && !nameValidation.success
      ? nameValidation.error.issues[0].message
      : null;
  const hasChanges =
    !environment ||
    trimmedName !== environment.name ||
    branch !== environment.branch ||
    autoDeploy !== environment.autoDeploy;

  const close = () => {
    if (isSubmitting) return;
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!trimmedName || !branch || nameError || !hasChanges) return;

    setIsSubmitting(true);
    try {
      if (isEdit) {
        await api.environments.update(projectId, environment.id, {
          name: trimmedName,
          branch,
          autoDeploy,
        });
        toast.success(`Environment "${trimmedName}" updated`);
      } else {
        await api.environments.create(projectId, {
          name: trimmedName,
          branch,
          autoDeploy,
        });
        toast.success(`Environment "${trimmedName}" created`);
      }
      queryClient.invalidateQueries({ queryKey: ["environments", projectId] });
      onOpenChange(false);
    } catch {
      // error toast already surfaced by the API client
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit environment" : "New environment"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.25">
            <label className="inline-block text-xs text-muted-foreground">
              Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="production"
              aria-invalid={!!nameError}
              autoFocus
            />
            {nameError && (
              <p className="text-xs text-destructive">{nameError}</p>
            )}
          </div>

          <div className="space-y-1.25">
            <label className="inline-block text-xs text-muted-foreground">
              Branch
            </label>
            <Select
              value={branch}
              onValueChange={(value) => setBranch(value ?? "")}
              disabled={branchesLoading}
            >
              <SelectTrigger className="w-full">
                <span>{branch || "Select a branch"}</span>
              </SelectTrigger>
              <SelectContent>
                {(branches ?? []).map((b) => (
                  <SelectItem key={b.name} value={b.name}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {environment && branch !== environment.branch && (
              <p className="text-xs text-muted-foreground leading-[1.4] mt-2">
                Changing the branch for this environment will trigger a new
                deployment.
              </p>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground pt-1">
            <Checkbox
              checked={autoDeploy}
              onCheckedChange={(checked) => setAutoDeploy(checked === true)}
            />
            Automatic deployments
          </label>

          {!isEdit && (
            <p className="text-xs text-muted-foreground leading-[1.4]">
              Creating this environment will trigger a new deployment from the
              selected branch.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={close} disabled={isSubmitting}>
            Cancel
          </Button>
          <LoadingButton
            loading={isSubmitting}
            disabled={!trimmedName || !branch || !!nameError || !hasChanges}
            onClick={handleSubmit}
          >
            {isEdit ? "Save changes" : "Create environment"}
          </LoadingButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
