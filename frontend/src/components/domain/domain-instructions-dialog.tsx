"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/shared/skeleton";
import { DnsInstructions } from "./dns-instructions";
import type { Domain } from "@/lib/types";

interface DomainInstructionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: Domain | null;
}

export function DomainInstructionsDialog({
  open,
  onOpenChange,
  domain,
}: DomainInstructionsDialogProps) {
  const {
    data: instructions,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["domain-instructions", domain?.id],
    queryFn: () => (domain ? api.domains.instructions(domain.id) : null),
    enabled: open && !!domain,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configure DNS</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Point{" "}
            <span className="font-mono text-foreground">
              {domain?.hostname}
            </span>{" "}
            at Orbit by adding this DNS record with your registrar.
          </p>

          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : isError || !instructions ? (
            <p className="text-sm text-muted-foreground">
              DNS instructions aren&apos;t available for this domain anymore.
            </p>
          ) : (
            <DnsInstructions instructions={instructions} />
          )}

          <p className="text-xs text-muted-foreground leading-[1.4]">
            DNS changes can take a few minutes to propagate. This domain will
            verify automatically once it resolves. Click the refresh button to
            check its status.
          </p>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
