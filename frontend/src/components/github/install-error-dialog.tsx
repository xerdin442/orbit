"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ErrorState } from "@/components/shared/error-state";

interface GitHubInstallErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
}

export function GitHubInstallErrorDialog({
  open,
  onOpenChange,
  onRetry,
}: GitHubInstallErrorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <ErrorState
          title="GitHub installation failed"
          description="We couldn't complete the GitHub App installation. Please try connecting again."
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
