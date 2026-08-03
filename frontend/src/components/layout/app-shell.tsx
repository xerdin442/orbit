"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useUIStore } from "@/lib/store";
import { Sidebar } from "@/components/sidebar/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    sidebarCollapsed,
    setSelectedProject,
    selectedProject,
    setSelectedEnvironment,
  } = useUIStore();

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60_000,
  });

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.projects.list(),
  });

  useEffect(() => {
    if (projects && projects.length > 0 && !selectedProject) {
      const first = projects[0];
      setSelectedProject(first);
    }
  }, [projects, selectedProject, setSelectedProject]);

  useEffect(() => {
    if (selectedProject && user) {
      api.environments.list(selectedProject.id).then((envs) => {
        if (envs.length > 0) {
          setSelectedEnvironment(envs[0]);
        }
      });
    }
  }, [selectedProject, user, setSelectedEnvironment]);

  if (userLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <Sidebar projects={projects ?? []} user={user!} />
      <div
        className={cn(
          "flex flex-1 flex-col transition-all duration-200",
          sidebarCollapsed ? "ml-16" : "ml-60",
        )}
      >
        <TopNav />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
