"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Database, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SkeletonCard } from "@/components/shared/skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { CreateResourceDialog } from "@/components/resource/create-resource-dialog";
import { DeleteResourceDialog } from "@/components/resource/delete-resource-dialog";
import { useSelectedEnvironment } from "@/hooks/use-selected-environment";
import { RESOURCE_TYPE_LABELS, RESOURCE_TYPE_LOGOS } from "@/lib/utils";
import type { Resource } from "@/lib/types";

function connectionSummary(resource: Resource): string {
  if (!resource.hostname) return "Not yet available";

  const ports = resource.ports ? Object.keys(resource.ports) : [];
  return ports.length > 0
    ? `${resource.hostname}:${ports[0]}`
    : resource.hostname;
}

export default function ResourcesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { selectedEnvironment } = useSelectedEnvironment(projectId);
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<Resource | null>(null);

  const { data: resources, isLoading } = useQuery({
    queryKey: ["resources", selectedEnvironment?.id],
    queryFn: () =>
      selectedEnvironment ? api.resources.list(selectedEnvironment.id) : null,
    enabled: !!selectedEnvironment,
  });

  const invalidateResources = () => {
    queryClient.invalidateQueries({
      queryKey: ["resources", selectedEnvironment?.id],
    });
  };

  return (
    <div>
      <PageHeader title="Resources">
        <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-3.5" />
          Add Resource
        </Button>
      </PageHeader>

      {isLoading || !selectedEnvironment ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : resources && resources.length === 0 ? (
        <EmptyState
          icon={Database}
          title="No resources yet"
          description="Attach a managed database to this environment to get started."
          action={{ label: "Add Resource", onClick: () => setCreateOpen(true) }}
          className="py-16"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(resources ?? []).map((resource) => (
            <Link
              key={resource.id}
              href={`/projects/${projectId}/resources/${resource.id}`}
              className="group rounded-xl border border-border bg-card p-5 hover:border-ring/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="relative size-10 shrink-0">
                    <Image
                      src={RESOURCE_TYPE_LOGOS[resource.type]}
                      alt=""
                      fill
                      sizes="(min-width: 768px) 50vw, 100vw"
                      className="rounded-xs object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-medium text-foreground transition-colors group-hover:text-primary">
                      {resource.name}
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      {RESOURCE_TYPE_LABELS[resource.type]}
                    </p>
                  </div>
                </div>
                <StatusBadge variant={resource.status}>
                  {resource.status}
                </StatusBadge>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2">
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {connectionSummary(resource)}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDeleting(resource);
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </Link>
          ))}
        </div>
      )}

      {selectedEnvironment && (
        <>
          <CreateResourceDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            environmentId={selectedEnvironment.id}
            onCreated={invalidateResources}
          />
          <DeleteResourceDialog
            open={!!deleting}
            onOpenChange={(open) => !open && setDeleting(null)}
            resource={deleting}
            onDeleted={invalidateResources}
          />
        </>
      )}
    </div>
  );
}
