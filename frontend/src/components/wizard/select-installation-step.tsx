"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, TriangleAlert } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { api } from "@/lib/api";
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/shared/skeleton";
import { Button } from "@/components/ui/button";
import type { GitHubInstallation } from "@/lib/types";

function GitHubIcon() {
  return <FontAwesomeIcon icon={faGithub} size="2xl" />;
}

interface SelectInstallationStepProps {
  onSelect: (installation: GitHubInstallation) => void;
  onBack?: () => void;
  prefillRepoFullName?: string | null;
}

export function SelectInstallationStep({
  onSelect,
  onBack,
  prefillRepoFullName,
}: SelectInstallationStepProps) {
  const prefillOwner = prefillRepoFullName?.split("/")[0] ?? null;
  const autoSelected = useRef(false);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const {
    data: installations,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["github", "installations"],
    queryFn: () => api.github.installations(),
  });

  const matchedInstallation = prefillOwner
    ? installations?.find(
        (inst) =>
          inst.accountLogin.toLowerCase() === prefillOwner.toLowerCase(),
      )
    : installations?.length === 1
      ? installations[0]
      : undefined;

  useEffect(() => {
    if (autoSelected.current || !matchedInstallation) return;
    autoSelected.current = true;

    const timeout = setTimeout(() => {
      onSelectRef.current(matchedInstallation);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [matchedInstallation]);

  const handleConnect = async () => {
    const url = await api.github.installUrl();
    window.location.href = url;
  };

  const autoAdvancing = !!matchedInstallation;
  const prefillMissing =
    !!prefillOwner &&
    !isLoading &&
    !isError &&
    !!installations &&
    !autoAdvancing;
  const showList =
    !isLoading &&
    !isError &&
    !!installations &&
    installations.length > 0 &&
    !autoAdvancing;

  return (
    <SectionCard
      title="Select GitHub Installation"
      description="Choose the GitHub account or organization to deploy from"
      actions={
        onBack && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={onBack}
          >
            <ArrowLeft className="size-3.5" />
            Change source
          </Button>
        )
      }
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
        <div className="space-y-3">
          {prefillMissing && prefillOwner && (
            <PrefillOwnerWarning
              owner={prefillOwner}
              tail=" to install the app for that account."
              onConnect={handleConnect}
            />
          )}

          <EmptyState
            icon={GitHubIcon}
            title="No GitHub installations"
            description="Connect your GitHub account and install the Orbit app."
            action={{ label: "Connect GitHub", onClick: handleConnect }}
            className="py-10"
          />
        </div>
      )}

      {!isLoading && !isError && matchedInstallation && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Continuing with {matchedInstallation.accountLogin}...
        </div>
      )}

      {showList && (
        <div className="space-y-3">
          {prefillMissing && prefillOwner && (
            <PrefillOwnerWarning
              owner={prefillOwner}
              tail=" to install the app for that account, or pick a different installation below."
              onConnect={handleConnect}
            />
          )}

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
        </div>
      )}
    </SectionCard>
  );
}

function PrefillOwnerWarning({
  owner,
  tail,
  onConnect,
}: {
  owner: string;
  tail: string;
  onConnect: () => void;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-yellow-500">
      <TriangleAlert className="mt-0.5 size-4.5 shrink-0" />
      <p className="text-xs leading-normal tracking-[0.01em]">
        <span className="font-medium">{owner}</span>
        {" isn't connected to Orbit yet. "}
        <button
          onClick={onConnect}
          className="cursor-pointer underline underline-offset-1 hover:no-underline"
        >
          Connect GitHub
        </button>
        {tail}
      </p>
    </div>
  );
}
