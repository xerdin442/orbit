"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/shared/loading-button";
import { api } from "@/lib/api";
import type { ExternalProvider } from "@/lib/types";
import { PROVIDER_LABEL } from "@/lib/utils";

const PROVIDER_TOKEN_URL: Record<ExternalProvider, string> = {
  railway: "https://railway.com/account/tokens",
  vercel: "https://vercel.com/account/tokens",
};

interface ConnectProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: ExternalProvider;
  onConnected: () => void;
}

export function ConnectProviderDialog({
  open,
  onOpenChange,
  provider,
  onConnected,
}: ConnectProviderDialogProps) {
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const label = PROVIDER_LABEL[provider];

  const close = (next: boolean) => {
    if (submitting) return;
    if (!next) setToken("");
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!token.trim() || submitting) return;

    setSubmitting(true);
    try {
      await api.migrations.connect(provider, token.trim());
      toast.success(`${label} connected`);
      setToken("");
      onOpenChange(false);
      onConnected();
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
          <DialogTitle>Connect {label}</DialogTitle>
          <DialogDescription className="leading-[1.4]!">
            Paste a {label} access token to let Orbit browse and import your{" "}
            {label} projects. This token can read (and modify) your {label}{" "}
            account. Consider a scoped token if you&apos;re only importing one
            project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.25">
          <label className="text-[0.8125rem] text-muted-foreground inline-block ml-px">
            Access token
          </label>
          <Input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste your token"
            type="password"
            autoFocus
          />
          <a
            href={PROVIDER_TOKEN_URL[provider]}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs text-primary hover:underline hover:underline-offset-2 ml-px"
          >
            {`Create a ${label} token →`}
          </a>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <LoadingButton
            onClick={handleSubmit}
            loading={submitting}
            disabled={!token.trim()}
          >
            Connect
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
