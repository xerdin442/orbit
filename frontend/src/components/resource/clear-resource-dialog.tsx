"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import type { Resource } from "@/lib/types";

interface ClearResourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: Resource | null;
  onCleared: () => void;
}

export function ClearResourceDialog({
  open,
  onOpenChange,
  resource,
  onCleared,
}: ClearResourceDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!resource || submitting) return;

    setSubmitting(true);
    try {
      await api.resources.clear(resource.id);
      toast.success("Clearing resource data...");
      onCleared();
      onOpenChange(false);
    } catch {
      // error toast already surfaced by the API client
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={(next) => !submitting && onOpenChange(next)}
      title="Reset resource data?"
      description="This wipes all data in this resource and re-provisions the container. This can't be undone."
      confirmLabel={submitting ? "Clearing..." : "Clear Data"}
      variant="destructive"
      loading={submitting}
      onConfirm={handleConfirm}
      onCancel={() => !submitting && onOpenChange(false)}
    />
  );
}
