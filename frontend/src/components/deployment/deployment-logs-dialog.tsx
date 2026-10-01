"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TerminalViewer } from "@/components/shared/terminal-viewer";
import { api } from "@/lib/api";
import { useSSE } from "@/hooks/use-sse";
import { formatLogLine, isBuildInProgress, logLevelColor } from "@/lib/utils";
import type { BuildStatus, DeploymentLog } from "@/lib/types";

const MOCK_MODE = process.env.NEXT_PUBLIC_MOCK_MODE === "true";

interface DeploymentLogsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  deploymentId: string;
  buildStatus: BuildStatus;
}

export function DeploymentLogsDialog({
  open,
  onOpenChange,
  projectId,
  deploymentId,
  buildStatus,
}: DeploymentLogsDialogProps) {
  const router = useRouter();

  const [logs, setLogs] = useState<DeploymentLog[]>([]);
  const [seededLogsFor, setSeededLogsFor] = useState<string | null>(null);

  const { data: persistedLogs, isLoading } = useQuery({
    queryKey: ["deployment-logs", deploymentId],
    queryFn: () => api.deployments.logs(deploymentId),
    enabled: open,
  });

  if (persistedLogs && seededLogsFor !== deploymentId) {
    setSeededLogsFor(deploymentId);
    setLogs(persistedLogs);
  }

  const isInProgress = isBuildInProgress(buildStatus);
  const streamUrl =
    open && isInProgress && !MOCK_MODE
      ? api.deployments.logsStreamUrl(deploymentId)
      : null;

  useSSE<DeploymentLog>(streamUrl, (entry) => {
    setLogs((prev) =>
      prev.some((l) => l.id === entry.id) ? prev : [...prev, entry],
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogTitle className="sr-only">Deployment Logs</DialogTitle>

        <TerminalViewer
          lines={
            isLoading
              ? [
                  {
                    text: "Threading logs...",
                    className: "text-muted-foreground animate-pulse",
                  },
                ]
              : logs.map((log) => ({
                  text: formatLogLine(log),
                  className: logLevelColor(log.level),
                }))
          }
          className="h-86 mt-7.5"
        />

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() =>
              router.push(`/projects/${projectId}/deployments/${deploymentId}`)
            }
          >
            See details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
