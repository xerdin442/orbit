"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useRedeployNavigation } from "@/hooks/use-redeploy-navigation";
import {
  VariableApplyFooter,
  type PendingVariableAction,
} from "./variable-apply-footer";
import type { EnvironmentVariable } from "@/lib/types";

interface DeleteVariableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  environmentId: string;
  variable: EnvironmentVariable | null;
}

export function DeleteVariableDialog({
  open,
  onOpenChange,
  projectId,
  environmentId,
  variable,
}: DeleteVariableDialogProps) {
  const [pendingAction, setPendingAction] =
    useState<PendingVariableAction>(null);
  const queryClient = useQueryClient();
  const goToDeployments = useRedeployNavigation(projectId, environmentId);

  const close = (next: boolean) => {
    if (pendingAction) return;
    onOpenChange(next);
  };

  const handleApply = async (skipRedeploy: boolean) => {
    if (!variable) return;

    setPendingAction(skipRedeploy ? "skip-redeploy" : "redeploy");
    try {
      await api.environments.variables.delete(
        projectId,
        variable.id,
        skipRedeploy,
      );
      queryClient.invalidateQueries({
        queryKey: ["variables", environmentId],
      });

      if (skipRedeploy) {
        toast.success(`Variable "${variable.key}" deleted`);
        close(false);
      } else {
        goToDeployments();
      }
    } catch {
      // error toast already surfaced by the API client
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply changes?</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-foreground">
          You&apos;re about to delete{" "}
          <span className="font-mono font-medium">{variable?.key}</span>.
        </p>

        <VariableApplyFooter
          description="Deleting this variable requires a new deployment for the change to take effect."
          pendingAction={pendingAction}
          skipLabel="Delete only"
          onSkipRedeploy={() => handleApply(true)}
          onRedeploy={() => handleApply(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
