"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/shared/skeleton";
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import type { GitHubInstallation } from "@/lib/types";

function GitHubIcon() {
  return <FontAwesomeIcon icon={faGithub} size="2xl" />;
}

interface InstallationListProps {
  installations: GitHubInstallation[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onConnect: () => void;
  onRemove: (installation: GitHubInstallation) => void;
  onRetry: () => void;
}

export function InstallationList({
  installations,
  isLoading,
  isError,
  onConnect,
  onRemove,
  onRetry,
}: InstallationListProps) {
  return (
    <SectionCard
      title="GitHub Installations"
      actions={
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={onConnect}
        >
          <FontAwesomeIcon icon={faGithub} />
          Connect GitHub
        </Button>
      }
    >
      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {isError && !isLoading && (
        <ErrorState
          title="Failed to load installations"
          description="Something went wrong while fetching your GitHub installations."
          onRetry={onRetry}
          className="py-8"
        />
      )}

      {!isLoading &&
        !isError &&
        installations &&
        installations.length === 0 && (
          <EmptyState
            icon={GitHubIcon}
            title="No GitHub installations"
            description="Connect your GitHub account and install the Orbit app."
            className="py-10"
          />
        )}

      {!isLoading && !isError && installations && installations.length > 0 && (
        <div className="space-y-2">
          {installations.map((inst) => (
            <div
              key={inst.installationId}
              className="flex items-center justify-between py-2 border-b border-border last:border-b-0"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-8 w-8 rounded-md bg-muted shrink-0">
                  <FontAwesomeIcon
                    icon={faGithub}
                    className="size-4 text-foreground"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {inst.accountLogin}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {inst.accountType}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => onRemove(inst)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
