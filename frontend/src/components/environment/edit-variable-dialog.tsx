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
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useRedeployNavigation } from "@/hooks/use-redeploy-navigation";
import {
  VariableApplyFooter,
  type PendingVariableAction,
} from "./variable-apply-footer";
import type { EnvironmentVariable } from "@/lib/types";

interface EditVariableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  environmentId: string;
  variable: EnvironmentVariable | null;
}

export function EditVariableDialog({
  open,
  onOpenChange,
  projectId,
  environmentId,
  variable,
}: EditVariableDialogProps) {
  const [key, setKey] = useState(variable?.key ?? "");
  const [value, setValue] = useState(variable?.value ?? "");
  const [pendingAction, setPendingAction] =
    useState<PendingVariableAction>(null);
  const queryClient = useQueryClient();
  const goToDeployments = useRedeployNavigation(projectId, environmentId);

  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (variable && seededFor !== variable.id) {
    setSeededFor(variable.id);
    setKey(variable.key);
    setValue(variable.value);
  }

  const close = (next: boolean) => {
    if (pendingAction) return;
    onOpenChange(next);
  };

  const trimmedKey = key.trim();
  const hasChanges =
    !!variable && (trimmedKey !== variable.key || value !== variable.value);

  const handleApply = async (skipRedeploy: boolean) => {
    if (!variable || !trimmedKey || !value || !hasChanges) return;

    setPendingAction(skipRedeploy ? "skip-redeploy" : "redeploy");
    try {
      await api.environments.variables.update(
        projectId,
        variable.id,
        {
          ...(trimmedKey !== variable.key && { key: trimmedKey }),
          ...(value !== variable.value && { value }),
        },
        skipRedeploy,
      );
      queryClient.invalidateQueries({
        queryKey: ["variables", environmentId],
      });

      if (skipRedeploy) {
        toast.success(`Variable "${trimmedKey}" updated`);
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

        <div className="space-y-3">
          <div className="space-y-1.25">
            <label className="inline-block text-xs text-muted-foreground">
              Key
            </label>
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="KEY"
              className="font-mono"
              autoFocus
            />
          </div>
          <div className="space-y-1.25">
            <label className="inline-block text-xs text-muted-foreground">
              Value
            </label>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="value"
              className="font-mono"
            />
          </div>
        </div>

        <VariableApplyFooter
          description="Updating this variable requires a new deployment for the change to take effect."
          pendingAction={pendingAction}
          disabled={!trimmedKey || !value || !hasChanges}
          skipLabel="Update only"
          onSkipRedeploy={() => handleApply(true)}
          onRedeploy={() => handleApply(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
