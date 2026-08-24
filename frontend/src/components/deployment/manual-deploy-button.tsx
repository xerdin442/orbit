"use client";

import { useState } from "react";
import { Rocket } from "lucide-react";
import type { VariantProps } from "class-variance-authority";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";

interface ManualDeployButtonProps {
  environmentId: string;
  branch: string;
  onDeployed: (deploymentId: string) => void;
  disabled?: boolean;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  className?: string;
}

export function ManualDeployButton({
  environmentId,
  branch,
  onDeployed,
  disabled,
  variant = "outline",
  size = "sm",
  className,
}: ManualDeployButtonProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { deploymentId } = await api.environments.deploy(
        environmentId,
        0,
      );
      setOpen(false);
      toast.success("Deployment triggered");
      onDeployed(deploymentId);
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
        <Rocket className="size-3.5" />
        Manual Deploy
      </Button>

      <ConfirmationDialog
        open={open}
        onOpenChange={(next) => !submitting && setOpen(next)}
        title="Trigger a manual deployment?"
        description={`This builds and deploys the latest commit on branch "${branch}".`}
        confirmLabel={submitting ? "Deploying..." : "Deploy"}
        loading={submitting}
        onConfirm={handleConfirm}
        onCancel={() => !submitting && setOpen(false)}
      />
    </>
  );
}
