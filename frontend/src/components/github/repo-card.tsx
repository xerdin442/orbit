"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { StatusBadge } from "@/components/shared/status-badge";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { GitHubBranch } from "@/lib/types";

interface RepoCardProps {
  repoUrl: string;
  installationLogin: string;
  autoDeploy: boolean;
  branches: GitHubBranch[];
  selectedBranch: string;
  isUpdating: boolean;
  onBranchChange: (branch: string | null) => void;
  onToggleConnection: () => void;
}

export function RepoCard({
  repoUrl,
  installationLogin,
  autoDeploy,
  branches,
  selectedBranch,
  isUpdating,
  onBranchChange,
  onToggleConnection,
}: RepoCardProps) {
  const repoName = repoUrl.replace("https://github.com/", "");

  return (
    <SectionCard className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center shrink-0">
            <FontAwesomeIcon icon={faGithub} size="xl" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground truncate">
                {repoName}
              </p>
              <StatusBadge
                variant={autoDeploy ? "ready" : "inactive"}
                className="text-[0.6875rem] px-1.5 py-px font-mono uppercase"
              >
                {autoDeploy ? "Connected" : "Disconnected"}
              </StatusBadge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Installed by {installationLogin}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">
            Branch
          </label>
          <Select
            value={selectedBranch}
            onValueChange={onBranchChange}
            disabled={isUpdating}
          >
            <SelectTrigger
              className={cn(
                "h-8 text-sm bg-muted text-muted-foreground border-0 w-45",
                autoDeploy && "text-foreground",
              )}
              size="sm"
            >
              <span>{selectedBranch}</span>
            </SelectTrigger>
            <SelectContent className="p-1">
              {branches.map((b) => (
                <SelectItem key={b.name} value={b.name}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="pt-4">
          <Button
            size="sm"
            variant="outline"
            className="text-[0.8125rem]"
            disabled={isUpdating}
            onClick={onToggleConnection}
          >
            {autoDeploy ? "Disconnect" : "Connect"}
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
