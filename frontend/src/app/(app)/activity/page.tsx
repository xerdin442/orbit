"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Activity, X } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/shared/skeleton";
import { ActivityItem } from "@/components/shared/activity-item";

const FILTER_KEYS = [
  "projectId",
  "deploymentId",
  "resourceId",
  "domainId",
  "environmentId",
  "type",
] as const;

const FILTER_LABELS: Record<(typeof FILTER_KEYS)[number], string> = {
  projectId: "project",
  deploymentId: "deployment",
  resourceId: "resource",
  domainId: "domain",
  environmentId: "environment",
  type: "activity type",
};

export default function ActivityPage() {
  const searchParams = useSearchParams();

  const filters = Object.fromEntries(
    FILTER_KEYS.map((key) => [key, searchParams.get(key) ?? undefined]).filter(
      ([, value]) => value !== undefined,
    ),
  );

  const activeFilterKey = FILTER_KEYS.find((key) => searchParams.get(key));

  const {
    data: activity,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["activity", filters],
    queryFn: () => api.activity.list(filters),
  });

  return (
    <div>
      <PageHeader
        title="Activity"
        description={
          activeFilterKey
            ? `Filtered by ${FILTER_LABELS[activeFilterKey]}`
            : "All activity across your projects"
        }
      >
        {activeFilterKey && activity && activity.length > 0 && (
          <Link
            href="/activity"
            className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-3.5" />
            Clear filter
          </Link>
        )}
      </PageHeader>

      <SectionCard>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            title="Failed to load activity"
            description="Something went wrong while fetching activity."
            onRetry={() => refetch()}
            className="py-16"
          />
        ) : activity && activity.length > 0 ? (
          <div className="space-y-3">
            {activity.map((a) => (
              <ActivityItem key={a.id} activity={a} details />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Activity}
            title="No activity yet"
            description="Actions taken across your projects will show up here."
            className="py-16"
          />
        )}
      </SectionCard>
    </div>
  );
}
