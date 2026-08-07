"use client";

import { useState } from "react";
import { Undo2 } from "lucide-react";
import type { VariantProps } from "class-variance-authority";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";

interface RollbackButtonProps {
  deploymentId: string;
  commitSha: string;
  onRolledBack: (newDeploymentId: string) => void;
  disabled?: boolean;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  className?: string;
}

export function RollbackButton({
  deploymentId,
  commitSha,
  onRolledBack,
  disabled,
  variant = "outline",
  size = "sm",
  className,
}: RollbackButtonProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { deploymentId: newDeploymentId } =
        await api.deployments.rollback(deploymentId);
      setOpen(false);
      toast.success("Rollback triggered");
      onRolledBack(newDeploymentId);
    } catch {
      // error toast already surfaced by the API client
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        disabled={disabled}
        className={className}
        onClick={() => setOpen(true)}
      >
        <Undo2 className="size-3.5" />
        Rollback
      </Button>

      <ConfirmationDialog
        open={open}
        onOpenChange={(next) => !submitting && setOpen(next)}
        title="Roll back to this version?"
        description={`This creates a new deployment from commit "${commitSha.slice(0, 7)}", and reuses its existing build image.`}
        confirmLabel={submitting ? "Rolling back..." : "Rollback"}
        onConfirm={handleConfirm}
        onCancel={() => !submitting && setOpen(false)}
      />
    </>
  );
}
