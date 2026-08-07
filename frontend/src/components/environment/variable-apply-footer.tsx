"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter } from "@/components/ui/dialog";

export type PendingVariableAction = "skip-redeploy" | "redeploy" | null;

interface VariableApplyFooterProps {
  description: string;
  pendingAction: PendingVariableAction;
  onSkipRedeploy: () => void;
  onRedeploy: () => void;
  disabled?: boolean;
  skipLabel?: string;
}

export function VariableApplyFooter({
  description,
  pendingAction,
  onSkipRedeploy,
  onRedeploy,
  disabled,
  skipLabel = "Add only",
}: VariableApplyFooterProps) {
  const busy = pendingAction !== null;

  return (
    <>
      <DialogDescription>{description}</DialogDescription>

      <DialogFooter>
        <Button
          variant="outline"
          disabled={disabled || busy}
          onClick={onSkipRedeploy}
        >
          {pendingAction === "skip-redeploy" && (
            <Loader2 className="size-3.5 animate-spin" />
          )}
          {skipLabel}
        </Button>
        <Button disabled={disabled || busy} onClick={onRedeploy}>
          {pendingAction === "redeploy" && (
            <Loader2 className="size-3.5 animate-spin" />
          )}
          Redeploy
        </Button>
      </DialogFooter>
    </>
  );
}
