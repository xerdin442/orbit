"use client";

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
import { formatLogLine, logLevelColor } from "@/lib/utils";

interface DeploymentLogsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  deploymentId: string;
}

export function DeploymentLogsDialog({
  open,
  onOpenChange,
  projectId,
  deploymentId,
}: DeploymentLogsDialogProps) {
  const router = useRouter();

  const { data: logs, isLoading } = useQuery({
    queryKey: ["deployment-logs", deploymentId],
    queryFn: () => api.deployments.logs(deploymentId),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogTitle className="sr-only">Deployment Logs</DialogTitle>

        <TerminalViewer
          lines={
            isLoading
              ? []
              : (logs ?? []).map((log) => ({
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
