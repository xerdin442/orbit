"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ErrorState } from "@/components/shared/error-state";

interface InstallErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onRetry: () => void;
}

export function InstallErrorDialog({
  open,
  onOpenChange,
  title,
  description,
  onRetry,
}: InstallErrorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <ErrorState
          title={title}
          description={description}
          onRetry={() => {
            onOpenChange(false);
            onRetry();
          }}
          className="py-4"
        />
      </DialogContent>
    </Dialog>
  );
}
