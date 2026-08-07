"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { VariantProps } from "class-variance-authority";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";

interface AbortButtonProps {
  deploymentId: string;
  onAborted: () => void;
  disabled?: boolean;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  className?: string;
}

export function AbortButton({
  deploymentId,
  onAborted,
  disabled,
  variant = "destructive",
  size = "sm",
  className,
}: AbortButtonProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.deployments.abort(deploymentId);
      setOpen(false);
      toast.success("Deployment aborted");
      onAborted();
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
        <X className="size-3.75" />
        Abort
      </Button>

      <ConfirmationDialog
        open={open}
        onOpenChange={(next) => !submitting && setOpen(next)}
        title="Abort this deployment?"
        description="This stops the in-progress build and marks the deployment as aborted. This can't be undone."
        confirmLabel={submitting ? "Aborting..." : "Abort"}
        variant="destructive"
        onConfirm={handleConfirm}
        onCancel={() => !submitting && setOpen(false)}
      />
    </>
  );
}
