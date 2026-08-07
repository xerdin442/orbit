"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useUIStore } from "@/lib/store";

export function useSelectedEnvironment(projectId: string) {
  const { selectedEnvironment, setSelectedEnvironment } = useUIStore();

  const { data: environments, isLoading } = useQuery({
    queryKey: ["environments", projectId],
    queryFn: () => api.environments.list(projectId),
    enabled: !!projectId,
  });

  useEffect(() => {
    if (!environments || environments.length === 0) return;
    if (!selectedEnvironment || selectedEnvironment.projectId !== projectId) {
      const env =
        environments.find((e) => e.name === "production") ?? environments[0];
      setSelectedEnvironment(env);
    }
  }, [environments, projectId, selectedEnvironment, setSelectedEnvironment]);

  return { selectedEnvironment, environments, isLoading };
}
