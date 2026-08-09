"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import type { Domain } from "@/lib/types";

interface DeleteDomainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: Domain | null;
  onDeleted: () => void;
}

export function DeleteDomainDialog({
  open,
  onOpenChange,
  domain,
  onDeleted,
}: DeleteDomainDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!domain || submitting) return;

    setSubmitting(true);
    try {
      await api.domains.delete(domain.id);
      toast.success(`Domain "${domain.hostname}" removed`);
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
      title="Remove this domain?"
      description={`"${domain?.hostname}" will no longer route traffic to this environment. This cannot be undone.`}
      confirmLabel={submitting ? "Removing..." : "Remove"}
      variant="destructive"
      requiresTyping={domain?.hostname ?? null}
      loading={submitting}
      onConfirm={handleConfirm}
      onCancel={() => !submitting && onOpenChange(false)}
    />
  );
}
