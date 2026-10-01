"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

export function useRedeployNavigation(
  projectId: string,
  environmentId: string,
) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return function goToDeployments() {
    queryClient.invalidateQueries({
      queryKey: ["deployments", environmentId],
    });
    router.push(`/projects/${projectId}/deployments`);
  };
}
