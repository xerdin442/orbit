"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useUIStore } from "@/lib/store";
import { SectionCard } from "@/components/shared/section-card";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { ConnectProviderDialog } from "@/components/shared/connect-provider-dialog";
import { ProviderIcon } from "@/components/shared/provider-icon";
import { TimestampDisplay } from "@/components/shared/timestamp-display";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import type { ExternalProvider } from "@/lib/types";

const PROVIDER_META: Record<
  ExternalProvider,
  { label: string; description: string }
> = {
  vercel: {
    label: "Vercel",
    description:
      "Import an existing Vercel project's repo, env vars, and domains.",
  },
  railway: {
    label: "Railway",
    description:
      "Import an existing Railway service's repo, env vars, and domains.",
  },
};

function ProviderCard({ provider }: { provider: ExternalProvider }) {
  const queryClient = useQueryClient();
  const { userProfile: user } = useUIStore();
  const [connecting, setConnecting] = useState(false);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const meta = PROVIDER_META[provider];
  const connection =
    user?.externalConnections.find((c) => c.provider === provider) ?? null;
  const isConnected = !!connection;

  const invalidateUser = () =>
    queryClient.invalidateQueries({ queryKey: ["auth", "me"] });

  const handleConfirmDisconnect = async () => {
    if (isDisconnecting) return;

    setIsDisconnecting(true);
    try {
      await api.migrations.disconnect(provider);
      toast.success(`${meta.label} disconnected`);
      invalidateUser();
      setConfirmingDisconnect(false);
    } catch {
      // error toast already surfaced by the API client
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div className="flex items-center gap-1.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
          <ProviderIcon provider={provider} className="size-6.5" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{meta.label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
        </div>
      </div>

      {isConnected && connection ? (
        <div className="flex items-center justify-between border-t border-border pt-3.5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <StatusBadge
              variant="ready"
              className="text-[0.8125rem] px-1.5 py-px font-mono uppercase"
            >
              Connected
            </StatusBadge>
            <TimestampDisplay
              value={connection.createdAt}
              className="text-[0.8125rem]"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => setConfirmingDisconnect(true)}
          >
            Disconnect
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setConnecting(true)}
        >
          Connect {meta.label}
        </Button>
      )}

      <ConnectProviderDialog
        open={connecting}
        onOpenChange={setConnecting}
        provider={provider}
        onConnected={invalidateUser}
      />

      <ConfirmationDialog
        open={confirmingDisconnect}
        onOpenChange={(open) =>
          !open && !isDisconnecting && setConfirmingDisconnect(false)
        }
        title={`Disconnect ${meta.label}?`}
        description={`Orbit will no longer be able to browse or import projects from your ${meta.label} account. You can reconnect at any time.`}
        confirmLabel={isDisconnecting ? "Disconnecting..." : "Disconnect"}
        variant="destructive"
        loading={isDisconnecting}
        onConfirm={handleConfirmDisconnect}
        onCancel={() => setConfirmingDisconnect(false)}
      />
    </div>
  );
}

export function MigrationsSection() {
  return (
    <SectionCard
      title="Migrations"
      description="Connect Vercel or Railway to import an existing project into Orbit."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ProviderCard provider="vercel" />
        <ProviderCard provider="railway" />
      </div>
    </SectionCard>
  );
}
