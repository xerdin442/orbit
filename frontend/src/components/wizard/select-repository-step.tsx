"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { ArrowLeft, Lock, Globe, TriangleAlert } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/shared/skeleton";
import { SearchBar } from "@/components/shared/search-bar";
import { Button } from "@/components/ui/button";
import type { GitHubInstallation, GitHubRepository } from "@/lib/types";

function GitHubIcon({ className }: { className?: string }) {
  return <FontAwesomeIcon icon={faGithub} size="2xl" className={className} />;
}

interface SelectRepositoryStepProps {
  installation: GitHubInstallation;
  onSelect: (repository: GitHubRepository) => void;
  onBack: () => void;
  prefillRepoFullName?: string | null;
}

export function SelectRepositoryStep({
  installation,
  onSelect,
  onBack,
  prefillRepoFullName,
}: SelectRepositoryStepProps) {
  const [search, setSearch] = useState(
    prefillRepoFullName ? prefillRepoFullName.split("/").pop()! : "",
  );
  const autoSelected = useRef(false);

  const {
    data: repositories,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["github", "repositories", installation.installationId],
    queryFn: () => api.github.repositories(installation.installationId),
  });

  const filtered = (repositories ?? []).filter((r) =>
    r.full_name.toLowerCase().includes(search.toLowerCase()),
  );

  const prefillMatch = prefillRepoFullName
    ? (repositories ?? []).find((r) => r.full_name === prefillRepoFullName)
    : undefined;

  useEffect(() => {
    if (autoSelected.current || !prefillMatch) return;
    autoSelected.current = true;
    onSelect(prefillMatch);
  }, [prefillMatch, onSelect]);

  const prefillMissing =
    !!prefillRepoFullName && !isLoading && !isError && !prefillMatch;

  const handleUpdateAccess = async () => {
    const url = await api.github.updateAccessUrl(installation.installationId);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <SectionCard
      title="Select Repository"
      description={`Choose a repository from ${installation.accountLogin}`}
      actions={
        <Button variant="ghost" size="sm" className="text-xs" onClick={onBack}>
          <ArrowLeft className="size-3.5" />
          Change installation
        </Button>
      }
    >
      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {isError && !isLoading && (
        <ErrorState
          title="Failed to load repositories"
          description="Something went wrong while fetching repositories for this installation."
          onRetry={() => refetch()}
          className="py-7"
        />
      )}

      {!isLoading && !isError && repositories && (
        <div className="space-y-3">
          {prefillMissing && (
            <div className="flex items-start gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-yellow-500">
              <TriangleAlert className="mt-0.5 size-4.5 shrink-0" />
              <p className="text-xs leading-normal tracking-[0.01em]">
                <span className="font-medium">{prefillRepoFullName}</span>{" "}
                isn&apos;t accessible from this installation. Grant Orbit access
                to this account by updating your GitHub App permissions with the
                link below.
              </p>
            </div>
          )}

          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search repositories..."
            disabled={prefillMissing}
          />

          {filtered.length === 0 && (
            <EmptyState
              icon={GitHubIcon}
              title={
                repositories.length === 0 ? "No repositories" : "No matches"
              }
              description={
                repositories.length === 0
                  ? "This installation doesn't have access to any repositories yet."
                  : "Try a different search term."
              }
              className="py-7"
            />
          )}

          {filtered.length > 0 && (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {filtered.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => onSelect(repo)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted"
                >
                  <span className="truncate text-sm font-medium text-foreground">
                    {repo.full_name}
                  </span>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium",
                      repo.private
                        ? "bg-yellow-500/10 text-yellow-500"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {repo.private ? (
                      <Lock className="size-3" />
                    ) : (
                      <Globe className="size-3" />
                    )}
                    {repo.private ? "Private" : "Public"}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-border pt-3 text-center text-xs tracking-[0.015em] text-muted-foreground">
            Missing repo?{" "}
            <button
              onClick={handleUpdateAccess}
              className="cursor-pointer text-primary hover:underline"
            >
              Update GitHub App permissions
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
