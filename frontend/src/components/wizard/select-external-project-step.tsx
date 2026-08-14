"use client";

import { useState, type ComponentType } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, FolderX } from "lucide-react";
import { api } from "@/lib/api";
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/shared/skeleton";
import { SearchBar } from "@/components/shared/search-bar";
import { Button } from "@/components/ui/button";
import { ConnectProviderDialog } from "@/components/shared/connect-provider-dialog";
import { ProviderIcon } from "@/components/shared/provider-icon";
import type {
  ExternalProjectDetail,
  ExternalProjectSummary,
  ExternalProvider,
} from "@/lib/types";

const PROVIDER_LABEL: Record<ExternalProvider, string> = {
  railway: "Railway",
  vercel: "Vercel",
};

function RailwayIcon() {
  return <ProviderIcon provider="railway" className="size-8" />;
}

function VercelIcon() {
  return <ProviderIcon provider="vercel" className="size-8" />;
}

const PROVIDER_ICON: Record<
  ExternalProvider,
  ComponentType<{ className?: string }>
> = {
  railway: RailwayIcon,
  vercel: VercelIcon,
};

interface SelectExternalProjectStepProps {
  provider: ExternalProvider;
  onSelect: (detail: ExternalProjectDetail) => void;
  onBack: () => void;
}

export function SelectExternalProjectStep({
  provider,
  onSelect,
  onBack,
}: SelectExternalProjectStepProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);

  const label = PROVIDER_LABEL[provider];

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60_000,
  });

  const isConnected = !!user?.externalConnections.some(
    (c) => c.provider === provider,
  );

  const {
    data: projects,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["migrations", provider, "projects"],
    queryFn: () => api.migrations.listProjects(provider),
    enabled: isConnected,
  });

  const filtered = (projects ?? []).filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const grouped = new Map<string | undefined, ExternalProjectSummary[]>();
  for (const p of filtered) {
    grouped.set(p.groupLabel, [...(grouped.get(p.groupLabel) ?? []), p]);
  }

  const handleSelect = async (summary: ExternalProjectSummary) => {
    if (!summary.repoFullName || selectingId) return;

    setSelectingId(summary.id);
    try {
      const detail = await api.migrations.getProject(provider, summary.id);
      onSelect(detail);
    } catch {
      // error toast already surfaced by the API client
    } finally {
      setSelectingId(null);
    }
  };

  const handleConnected = () => {
    queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    queryClient.invalidateQueries({
      queryKey: ["migrations", provider, "projects"],
    });
  };

  return (
    <SectionCard
      title={`Import from ${label}`}
      description={`Choose a ${label} project to import into Orbit`}
      actions={
        <Button variant="ghost" size="sm" className="text-xs" onClick={onBack}>
          <ArrowLeft className="size-3.5" />
          Change source
        </Button>
      }
    >
      {userLoading && (
        <div className="space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      )}

      {!userLoading && !isConnected && (
        <EmptyState
          icon={PROVIDER_ICON[provider]}
          title={`Connect ${label}`}
          description={`Connect your ${label} account to browse and import a project.`}
          action={{
            label: `Connect ${label}`,
            onClick: () => setConnecting(true),
          }}
          className="py-10"
        />
      )}

      {isConnected && isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      )}

      {isConnected && isError && !isLoading && (
        <ErrorState
          title={`Failed to load ${label} projects`}
          description={`Something went wrong while fetching your ${label} projects.`}
          onRetry={() => refetch()}
          className="py-7"
        />
      )}

      {isConnected && !isLoading && !isError && projects && (
        <div className="space-y-3">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder={`Search ${label} projects...`}
          />

          {filtered.length === 0 && (
            <EmptyState
              icon={FolderX}
              title={projects.length === 0 ? "No projects found" : "No matches"}
              description={
                projects.length === 0
                  ? `No projects were found on your connected ${label} account.`
                  : "Try a different search term."
              }
              className="py-7"
            />
          )}

          {filtered.length > 0 && (
            <div className="max-h-96 space-y-4 overflow-y-auto">
              {[...grouped.entries()].map(([groupLabel, items]) => (
                <div key={groupLabel ?? "__ungrouped"} className="space-y-2">
                  {groupLabel && (
                    <p className="px-1 text-[0.6875rem] font-medium tracking-[0.06em] text-muted-foreground uppercase">
                      {groupLabel}
                    </p>
                  )}
                  {items.map((item) => {
                    const disabled = !item.repoFullName;
                    const selecting = selectingId === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelect(item)}
                        disabled={disabled || !!selectingId}
                        className="flex w-full items-center justify-between gap-3 rounded-lg border border-border p-3 text-left transition-colors enabled:hover:border-primary/40 enabled:hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {item.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {item.repoFullName ??
                              "Not connected to a GitHub repository"}
                          </p>
                        </div>
                        {selecting && (
                          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ConnectProviderDialog
        open={connecting}
        onOpenChange={setConnecting}
        provider={provider}
        onConnected={handleConnected}
      />
    </SectionCard>
  );
}
