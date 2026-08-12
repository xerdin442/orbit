"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSlack } from "@fortawesome/free-brands-svg-icons";
import { SquareArrowOutUpRight } from "lucide-react";
import { api } from "@/lib/api";
import { useUIStore } from "@/lib/store";
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState } from "@/components/shared/empty-state";
import { KeyValueList } from "@/components/shared/key-value-list";
import { TimestampDisplay } from "@/components/shared/timestamp-display";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";

function SlackIcon() {
  return <FontAwesomeIcon icon={faSlack} size="2xl" />;
}

export function SlackSection() {
  const queryClient = useQueryClient();
  const { userProfile: user } = useUIStore();
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const installation = user?.slackInstallation;
  const isConnected = !!installation?.isActive;

  const handleConnect = async () => {
    const url = await api.slack.installUrl();
    window.location.href = url;
  };

  const handleOpenWorkspace = (teamId: string) => {
    window.open(
      `https://slack.com/app_redirect?team=${teamId}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const handleConfirmDisconnect = async () => {
    if (isDisconnecting) return;

    setIsDisconnecting(true);
    try {
      await api.slack.disconnect();
      toast.success("Slack workspace disconnected");
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      setConfirmingDisconnect(false);
    } catch {
      // error toast already surfaced by the API client
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <SectionCard title="Slack">
      {!isConnected && (
        <EmptyState
          icon={SlackIcon}
          title="Connect Slack"
          description="Receive deployment notifications and manage your applications directly from Slack."
          action={{ label: "Connect Slack", onClick: handleConnect }}
          className="py-10"
        />
      )}

      {isConnected && installation && (
        <div className="space-y-5">
          <KeyValueList
            items={[
              { key: "Workspace", value: installation.teamName ?? "—" },
              { key: "Team ID", value: installation.teamId },
              {
                key: "Installer Slack User ID",
                value: installation.installerSlackUserId,
              },
            ]}
          />

          <div className="flex items-center justify-between border-t border-border pt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <StatusBadge
                variant="ready"
                className="text-[0.8125rem] px-1.5 py-px font-mono uppercase"
              >
                Connected
              </StatusBadge>{" "}
              <TimestampDisplay
                value={installation.createdAt}
                className="text-[0.8125rem]"
              />
            </div>
            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenWorkspace(installation.teamId)}
              >
                <SquareArrowOutUpRight className="size-3.5" />
                Open Workspace
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmingDisconnect(true)}
              >
                Disconnect
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={confirmingDisconnect}
        onOpenChange={(open) =>
          !open && !isDisconnecting && setConfirmingDisconnect(false)
        }
        title="Disconnect Slack?"
        description="Orbit will stop sending deployment notifications to this workspace and the Orbit app will be uninstalled from Slack. You can reconnect at any time."
        confirmLabel={isDisconnecting ? "Disconnecting..." : "Disconnect"}
        variant="destructive"
        loading={isDisconnecting}
        onConfirm={handleConfirmDisconnect}
        onCancel={() => setConfirmingDisconnect(false)}
      />
    </SectionCard>
  );
}
