"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SkeletonCard } from "@/components/shared/skeleton";
import { Button } from "@/components/ui/button";
import { FolderOpen, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub } from "@fortawesome/free-brands-svg-icons";

function formatLastUpdated(date: string) {
  const d = new Date(date);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (d.getFullYear() !== new Date().getFullYear()) {
    opts.year = "numeric";
  }
  return `Last updated: ${d.toLocaleDateString("en-US", opts)}`;
}

export default function ProjectsPage() {
  const router = useRouter();
  const {
    data: projects,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.projects.list(),
  });

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Manage your deployed applications"
      >
        <Button
          onClick={() => router.push("/projects/new")}
          size="sm"
          className="text-sm"
        >
          <Plus className="size-4" />
          New Project
        </Button>
      </PageHeader>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {isError && (
        <EmptyState
          icon={FolderOpen}
          title="Failed to load projects"
          description="An error occurred while fetching your projects."
          action={{ label: "Retry", onClick: () => window.location.reload() }}
        />
      )}

      {projects && projects.length === 0 && (
        <EmptyState
          icon={FolderOpen}
          title="No projects yet"
          description="Create your first project to start deploying applications."
          action={{ label: "New Project", href: "/projects/new" }}
        />
      )}

      {projects && projects.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group rounded-xl border border-border bg-card p-6 hover:border-ring/30 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-base font-medium text-foreground group-hover:text-primary transition-colors">
                    {project.name}
                  </h3>
                </div>

                {project.source && (
                  <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                    <FontAwesomeIcon
                      icon={faGithub}
                      className="size-3.5 shrink-0"
                    />
                    <span className="truncate">
                      {project.source.repositoryUrl.replace(
                        "https://github.com/",
                        "",
                      )}
                    </span>
                  </div>
                )}

                <p className="text-xs tracking-[0.015em] text-muted-foreground/80 mt-4">
                  {formatLastUpdated(project.updatedAt)}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
