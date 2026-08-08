"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import type { Resource } from "@/lib/types";

interface DeleteResourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: Resource | null;
  onDeleted: () => void;
}

export function DeleteResourceDialog({
  open,
  onOpenChange,
  resource,
  onDeleted,
}: DeleteResourceDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!resource || submitting) return;

    setSubmitting(true);
    try {
      await api.resources.delete(resource.id);
      toast.success(`Resource "${resource.name}" deleted`);
      onDeleted();
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
      title="Delete this resource?"
      description={`This permanently deletes "${resource?.name}" and all of its data. This can't be undone.`}
      confirmLabel={submitting ? "Deleting..." : "Delete"}
      variant="destructive"
      requiresTyping={resource?.name ?? null}
      loading={submitting}
      onConfirm={handleConfirm}
      onCancel={() => !submitting && onOpenChange(false)}
    />
  );
}
