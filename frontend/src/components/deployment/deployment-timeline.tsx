import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BuildStatus } from "@/lib/types";

const STAGES: { status: BuildStatus; label: string }[] = [
  { status: "pending", label: "Pending" },
  { status: "cloning", label: "Cloning" },
  { status: "building", label: "Building" },
  { status: "deploying", label: "Deploying" },
  { status: "ready", label: "Ready" },
];

interface DeploymentTimelineProps {
  buildStatus: BuildStatus;
  failedStage?: BuildStatus | null;
}

export function DeploymentTimeline({
  buildStatus,
  failedStage,
}: DeploymentTimelineProps) {
  const isTerminalFailure =
    buildStatus === "failed" || buildStatus === "aborted";
  const failedStageIndex = failedStage
    ? STAGES.findIndex((s) => s.status === failedStage)
    : -1;
  const currentIndex = isTerminalFailure
    ? failedStageIndex !== -1
      ? failedStageIndex
      : STAGES.length - 1
    : STAGES.findIndex((s) => s.status === buildStatus);

  return (
    <ol className="flex items-center">
      {STAGES.map((stage, index) => {
        const isLast = index === STAGES.length - 1;
        const isFailedNode = isTerminalFailure && index === currentIndex;
        const isComplete =
          index < currentIndex ||
          (!isTerminalFailure &&
            index === currentIndex &&
            buildStatus === "ready");
        const isCurrent =
          !isTerminalFailure &&
          index === currentIndex &&
          buildStatus !== "ready";

        return (
          <li
            key={stage.status}
            className="flex flex-1 items-center last:flex-none"
          >
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors",
                  isFailedNode &&
                    "bg-destructive/15 text-destructive ring-1 ring-destructive",
                  !isFailedNode &&
                    isComplete &&
                    "bg-primary text-primary-foreground",
                  !isFailedNode &&
                    isCurrent &&
                    "bg-primary/10 text-primary ring-1 ring-primary animate-pulse",
                  !isFailedNode &&
                    !isComplete &&
                    !isCurrent &&
                    "bg-muted text-muted-foreground",
                )}
              >
                {isFailedNode ? (
                  <X className="size-3.5" />
                ) : isComplete ? (
                  <Check className="size-3.5" />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={cn(
                  "text-[0.6875rem] font-medium whitespace-nowrap",
                  isFailedNode
                    ? "text-destructive"
                    : isCurrent || isComplete
                      ? "text-foreground"
                      : "text-muted-foreground",
                )}
              >
                {stage.label}
              </span>
            </div>
            {!isLast && (
              <div
                className={cn(
                  "mx-2 mb-4.5 h-px flex-1",
                  index < currentIndex ? "bg-primary" : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
