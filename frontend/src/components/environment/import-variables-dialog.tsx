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

interface ImportVariablesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  environmentId: string;
  variables: { key: string; value: string }[];
}

export function ImportVariablesDialog({
  open,
  onOpenChange,
  projectId,
  environmentId,
  variables,
}: ImportVariablesDialogProps) {
  const [pendingAction, setPendingAction] =
    useState<PendingVariableAction>(null);
  const queryClient = useQueryClient();
  const goToDeployments = useRedeployNavigation(projectId, environmentId);

  const close = (next: boolean) => {
    if (pendingAction) return;
    onOpenChange(next);
  };

  const handleApply = async (skipRedeploy: boolean) => {
    if (variables.length === 0) return;

    setPendingAction(skipRedeploy ? "skip-redeploy" : "redeploy");
    try {
      await api.environments.variables.bulkCreate(
        projectId,
        environmentId,
        variables,
        skipRedeploy,
      );
      queryClient.invalidateQueries({
        queryKey: ["variables", environmentId],
      });

      if (skipRedeploy) {
        toast.success(
          `${variables.length} variable${variables.length > 1 ? "s" : ""} added`,
        );
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {variables.length} variable{variables.length !== 1 ? "s" : ""}{" "}
            detected
          </DialogTitle>
        </DialogHeader>

        <div className="custom-scrollbar max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
          {variables.map((v, i) => (
            <div
              key={`${v.key}-${i}`}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-mono"
            >
              <span className="text-foreground">{v.key}</span>
              <span className="text-muted-foreground">=</span>
              <span className="truncate text-muted-foreground">{v.value}</span>
            </div>
          ))}
        </div>

        <VariableApplyFooter
          description={`Importing ${variables.length} variable${variables.length > 1 ? "s" : ""} requires a new deployment for the changes to take effect.`}
          pendingAction={pendingAction}
          disabled={variables.length === 0}
          onSkipRedeploy={() => handleApply(true)}
          onRedeploy={() => handleApply(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
