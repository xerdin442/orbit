"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  FolderGit2,
  GitCommitHorizontal,
  Layers,
  List,
  Rocket,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { SectionCard } from "@/components/shared/section-card";
import { LoadingButton } from "@/components/shared/loading-button";
import type { GitHubRepository, Project } from "@/lib/types";

interface DeploySummaryStepProps {
  project: Project;
  repository: GitHubRepository;
  branch: string;
  environmentId: string;
  envVarCount: number;
  resourceCount: number;
}

export function DeploySummaryStep({
  project,
  repository,
  branch,
  environmentId,
  envVarCount,
  resourceCount,
}: DeploySummaryStepProps) {
  const router = useRouter();
  const [deploying, setDeploying] = useState(false);

  const handleDeploy = async () => {
    setDeploying(true);
    try {
      const { deploymentId } = await api.environments.deploy(
        environmentId,
        resourceCount,
      );
      toast.success("Deployment triggered");
      router.push(`/projects/${project.id}/deployments/${deploymentId}`);
    } catch {
      // error toast already surfaced by the API client
    } finally {
      setDeploying(false);
    }
  };

  const summaryRows = [
    { label: "Project", value: project.name, icon: Box },
    { label: "Repository", value: repository.full_name, icon: FolderGit2 },
    { label: "Branch", value: branch, icon: GitCommitHorizontal },
    {
      label: "Environment variables",
      value: String(envVarCount),
      icon: List,
    },
    { label: "Attached resources", value: String(resourceCount), icon: Layers },
  ];

  return (
    <SectionCard
      title="Deploy"
      description="Review your configuration and trigger the first deployment"
    >
      <div className="space-y-0 rounded-lg border border-border">
        {summaryRows.map((row, i) => (
          <div
            key={row.label}
            className={
              "flex items-center justify-between px-4 py-3 text-sm" +
              (i !== summaryRows.length - 1 ? " border-b border-border" : "")
            }
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <row.icon className="size-3.5" />
              {row.label}
            </span>
            <span className="font-medium text-foreground">{row.value}</span>
          </div>
        ))}
      </div>

      <LoadingButton
        onClick={handleDeploy}
        loading={deploying}
        className="mt-5 w-full"
        size="lg"
      >
        <Rocket className="size-4" />
        Deploy
      </LoadingButton>
    </SectionCard>
  );
}
