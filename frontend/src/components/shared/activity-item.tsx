"use client";

import type { ActivityLog, ActivityType } from "@/lib/types";
import { TimestampDisplay } from "./timestamp-display";
import {
  Rocket,
  KeyRound,
  Activity,
  ChevronDown,
  GlobeCheck,
  GlobeX,
  DatabaseX,
  DatabasePlus,
  DatabaseZap,
  GlobeLock,
  FolderX,
  FolderPlus,
  FolderSync,
  LayersPlus,
  LayersMinus,
  Layers2,
  UserRoundPlus,
  UserRoundKey,
  Undo2,
  OctagonX,
  Hourglass,
  CircleX,
} from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub, faSlack } from "@fortawesome/free-brands-svg-icons";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface ActivityItemProps {
  activity: ActivityLog;
  details?: boolean;
  className?: string;
}

const iconMap: Record<ActivityType, React.ReactNode> = {
  user_signed_up: <UserRoundPlus className="size-4" />,
  user_signed_in: <UserRoundKey className="size-4" />,
  project_created: <FolderPlus className="size-4.5" />,
  project_updated: <FolderSync className="size-4.5" />,
  project_deleted: <FolderX className="size-4.5" />,
  environment_created: <LayersPlus className="size-4" />,
  environment_updated: <Layers2 className="size-4" />,
  environment_deleted: <LayersMinus className="size-4" />,
  deployment_started: <Hourglass className="size-3.75" />,
  deployment_completed: <Rocket className="size-4" />,
  deployment_failed: <CircleX className="size-4.25" />,
  deployment_rolled_back: <Undo2 className="size-4" />,
  deployment_aborted: <OctagonX className="size-4" />,
  variable_created: <KeyRound className="size-4" />,
  variable_updated: <KeyRound className="size-4" />,
  variable_deleted: <KeyRound className="size-4" />,
  domain_added: <GlobeCheck className="size-4" />,
  domain_removed: <GlobeX className="size-4" />,
  domain_verified: <GlobeLock className="size-4" />,
  github_installation_added: (
    <FontAwesomeIcon icon={faGithub} className="size-3.5" />
  ),
  github_installation_removed: (
    <FontAwesomeIcon icon={faGithub} className="size-3.5" />
  ),
  github_webhook_event: (
    <FontAwesomeIcon icon={faGithub} className="size-3.5" />
  ),
  resource_provisioned: <DatabasePlus className="size-4" />,
  resource_deleted: <DatabaseX className="size-4" />,
  resource_data_cleared: <DatabaseZap className="size-4" />,
  slack_installation_added: (
    <FontAwesomeIcon icon={faSlack} className="size-3.5" />
  ),
  slack_installation_removed: (
    <FontAwesomeIcon icon={faSlack} className="size-3.5" />
  ),
  slack_token_revoked: <FontAwesomeIcon icon={faSlack} className="size-3.5" />,
};

function formatType(type: ActivityType): string {
  return type.replace(/_/g, " ");
}

export function ActivityItem({
  activity,
  details = false,
  className,
}: ActivityItemProps) {
  const [expanded, setExpanded] = useState(false);
  const icon = iconMap[activity.type] ?? <Activity className="size-4" />;

  return (
    <div
      className={cn(
        "border-b border-border last:border-b-0 pb-3 last:pb-0",
        className,
      )}
    >
      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground shrink-0">{icon}</span>
        <span className="text-foreground truncate flex-1">
          {formatType(activity.type)}
        </span>
        <TimestampDisplay
          value={activity.createdAt}
          className="text-xs shrink-0"
        />
      </div>

      {details && (
        <div className="mt-2">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Details
            <ChevronDown
              className={cn(
                "size-3 transition-transform duration-200",
                expanded && "rotate-180",
              )}
            />
          </button>
          {expanded && activity.metadata && (
            <pre className="mt-2 rounded-md bg-muted p-2 text-xs text-muted-foreground overflow-auto leading-snug custom-scrollbar">
              {JSON.stringify(activity.metadata, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
