"use client";

import { useState } from "react";
import { RotateCw } from "lucide-react";
import type { VariantProps } from "class-variance-authority";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";

interface RedeployButtonProps {
  environmentId: string;
  commitSha: string;
  branch: string;
  onRedeployed: () => void;
  disabled?: boolean;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  className?: string;
}

export function RedeployButton({
  environmentId,
  commitSha,
  branch,
  onRedeployed,
  disabled,
  variant = "outline",
  size = "sm",
  className,
}: RedeployButtonProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.environments.redeploy(environmentId);
      setOpen(false);
      toast.success("Redeploy triggered");
      onRedeployed();
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
        <RotateCw className="size-3.5" />
        Redeploy
      </Button>

      <ConfirmationDialog
        open={open}
        onOpenChange={(next) => !submitting && setOpen(next)}
        title="Redeploy this version?"
        description={`This triggers a new deployment of commit "${commitSha.slice(0, 7)}" on branch "${branch}", reusing the existing build image.`}
        confirmLabel={submitting ? "Redeploying..." : "Redeploy"}
        loading={submitting}
        onConfirm={handleConfirm}
        onCancel={() => !submitting && setOpen(false)}
      />
    </>
  );
}
