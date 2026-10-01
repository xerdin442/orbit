"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { hostnameSchema } from "@/lib/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/shared/loading-button";
import { DnsInstructions } from "./dns-instructions";
import type { DNSInstructions } from "@/lib/types";

interface AddDomainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  environmentId: string;
  onAdded: () => void;
}

export function AddDomainDialog({
  open,
  onOpenChange,
  environmentId,
  onAdded,
}: AddDomainDialogProps) {
  const [hostname, setHostname] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [instructions, setInstructions] = useState<DNSInstructions | null>(
    null,
  );

  const reset = () => {
    setHostname("");
    setError("");
    setInstructions(null);
  };

  const close = (next: boolean) => {
    if (submitting) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const updateHostname = (value: string) => {
    setHostname(value);
    const result = hostnameSchema.safeParse(value);
    setError(result.success ? "" : result.error.issues[0].message);
  };

  const canSubmit = hostnameSchema.safeParse(hostname).success;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    try {
      const dns = await api.domains.add(environmentId, {
        hostname: hostname.toLowerCase(),
      });
      setInstructions(dns);
      onAdded();
    } catch {
      // error toast already surfaced by the API client
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {instructions ? "Configure DNS" : "Add Domain"}
          </DialogTitle>
        </DialogHeader>

        {!instructions ? (
          <>
            <div className="space-y-1.25">
              <label className="inline-block text-[0.8125rem] text-muted-foreground">
                Hostname
              </label>
              <Input
                value={hostname}
                onChange={(e) => updateHostname(e.target.value)}
                placeholder="app.example.com"
                className="font-mono"
                autoFocus
              />
              {error && <p className="text-[11px] text-destructive">{error}</p>}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)}>
                Cancel
              </Button>
              <LoadingButton
                onClick={handleSubmit}
                loading={submitting}
                disabled={!canSubmit}
              >
                Add Domain
              </LoadingButton>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Point{" "}
                <span className="font-mono text-foreground">{hostname}</span> at
                Orbit by adding this DNS record with your registrar.
              </p>

              <DnsInstructions instructions={instructions} />

              <p className="text-xs text-muted-foreground leading-[1.4]">
                DNS changes can take a few minutes to propagate. This domain
                will verify automatically once it resolves. Click the refresh
                button to check its status.
              </p>
            </div>

            <DialogFooter>
              <Button onClick={() => close(false)}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
