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

interface AddVariableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  environmentId: string;
}

export function AddVariableDialog({
  open,
  onOpenChange,
  projectId,
  environmentId,
}: AddVariableDialogProps) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [pendingAction, setPendingAction] =
    useState<PendingVariableAction>(null);
  const queryClient = useQueryClient();
  const goToDeployments = useRedeployNavigation(projectId, environmentId);

  const reset = () => {
    setKey("");
    setValue("");
  };

  const close = (next: boolean) => {
    if (pendingAction) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const handleApply = async (skipRedeploy: boolean) => {
    const trimmedKey = key.trim();
    if (!trimmedKey || !value) return;

    setPendingAction(skipRedeploy ? "skip-redeploy" : "redeploy");
    try {
      await api.environments.variables.create(
        projectId,
        environmentId,
        { key: trimmedKey, value },
        skipRedeploy,
      );
      queryClient.invalidateQueries({
        queryKey: ["variables", environmentId],
      });

      if (skipRedeploy) {
        toast.success(`Variable "${trimmedKey}" added`);
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
          <DialogTitle>Add new variable</DialogTitle>
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
          description="Adding this variable requires a new deployment for the change to take effect."
          pendingAction={pendingAction}
          disabled={!key.trim() || !value}
          onSkipRedeploy={() => handleApply(true)}
          onRedeploy={() => handleApply(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
