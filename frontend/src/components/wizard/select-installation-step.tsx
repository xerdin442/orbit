"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { api } from "@/lib/api";
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/shared/skeleton";
import type { GitHubInstallation } from "@/lib/types";

function GitHubIcon() {
  return <FontAwesomeIcon icon={faGithub} size="2xl" />;
}

interface SelectInstallationStepProps {
  onSelect: (installation: GitHubInstallation) => void;
}

export function SelectInstallationStep({
  onSelect,
}: SelectInstallationStepProps) {
  const {
    data: installations,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["github", "installations"],
    queryFn: () => api.github.installations(),
  });

  useEffect(() => {
    if (installations?.length === 1) {
      onSelect(installations[0]);
    }
  }, [installations, onSelect]);

  const handleConnect = async () => {
    const url = await api.github.installUrl();
    window.location.href = url;
  };

  const showList = installations && installations.length > 1;
  const autoAdvancing = installations && installations.length === 1;

  return (
    <SectionCard
      title="Select GitHub Installation"
      description="Choose the GitHub account or organization to deploy from"
    >
      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      )}

      {isError && !isLoading && (
        <ErrorState
          title="Failed to load installations"
          description="Something went wrong while fetching your GitHub installations."
          onRetry={() => refetch()}
          className="py-8"
        />
      )}

      {!isLoading && !isError && installations?.length === 0 && (
        <EmptyState
          icon={GitHubIcon}
          title="No GitHub installations"
          description="Connect your GitHub account and install the Orbit app."
          action={{ label: "Connect GitHub", onClick: handleConnect }}
          className="py-10"
        />
      )}

      {!isLoading && !isError && autoAdvancing && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Continuing with {installations[0].accountLogin}...
        </div>
      )}

      {!isLoading && !isError && showList && (
        <div className="space-y-2">
          {installations.map((inst) => (
            <button
              key={inst.installationId}
              onClick={() => onSelect(inst)}
              className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
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
            </button>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
