"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useUIStore } from "@/lib/store";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { InstallationList } from "@/components/github/installation-list";

export default function AccountSettingsPage() {
  const queryClient = useQueryClient();
  const { userProfile: user } = useUIStore();

  const {
    data: installations,
    isLoading: installationsLoading,
    isError: installationsError,
  } = useQuery({
    queryKey: ["github", "installations"],
    queryFn: () => api.github.installations(),
  });

  const handleConnect = async () => {
    const url = await api.github.installUrl();
    window.location.href = url;
  };

  const handleRemove = async () => {
    queryClient.invalidateQueries({ queryKey: ["github", "installations"] });
  };

  const handleRetryInstallations = () => {
    queryClient.invalidateQueries({ queryKey: ["github", "installations"] });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Account Settings" />

      <SectionCard title="Profile">
        {user && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-24">
                Username
              </span>
              <span className="text-sm text-foreground font-medium">
                {user.githubUsername}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-24">Email</span>
              <span className="text-sm text-foreground">
                {user.email ?? "—"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-24">
                GitHub User ID
              </span>
              <span className="text-sm text-foreground font-mono">
                {user.githubUserId}
              </span>
            </div>
          </div>
        )}
      </SectionCard>

      <InstallationList
        installations={installations}
        isLoading={installationsLoading}
        isError={installationsError}
        onConnect={handleConnect}
        onRemove={handleRemove}
        onRetry={handleRetryInstallations}
      />
    </div>
  );
}
