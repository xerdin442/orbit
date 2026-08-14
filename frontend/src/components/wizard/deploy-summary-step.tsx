"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  FolderGit2,
  GitCommitHorizontal,
  Layers,
  List,
  Globe,
  Rocket,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { SectionCard } from "@/components/shared/section-card";
import { LoadingButton } from "@/components/shared/loading-button";
import { DnsInstructions } from "@/components/domain/dns-instructions";
import type { DNSInstructions, GitHubRepository, Project } from "@/lib/types";

interface DeploySummaryStepProps {
  project: Project;
  repository: GitHubRepository;
  branch: string;
  environmentId: string;
  envVarCount: number;
  resourceCount: number;
  importedDomains?: string[];
}

interface DomainImportResult {
  hostname: string;
  instructions: DNSInstructions | null;
}

export function DeploySummaryStep({
  project,
  repository,
  branch,
  environmentId,
  envVarCount,
  resourceCount,
  importedDomains = [],
}: DeploySummaryStepProps) {
  const router = useRouter();
  const [deploying, setDeploying] = useState(false);
  const [importingDomains, setImportingDomains] = useState(
    importedDomains.length > 0,
  );
  const [domainResults, setDomainResults] = useState<DomainImportResult[]>([]);

  useEffect(() => {
    if (importedDomains.length === 0) return;

    let cancelled = false;

    (async () => {
      const results: DomainImportResult[] = [];
      for (const hostname of importedDomains) {
        try {
          const instructions = await api.domains.add(environmentId, {
            hostname,
          });
          results.push({ hostname, instructions });
        } catch {
          // error toast already surfaced by the API client
          results.push({ hostname, instructions: null });
        }
      }
      if (!cancelled) {
        setDomainResults(results);
        setImportingDomains(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Runs once for the domain batch queued at import time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [environmentId]);

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
    ...(importedDomains.length > 0
      ? [
          {
            label: "Domains imported",
            value: String(importedDomains.length),
            icon: Globe,
          },
        ]
      : []),
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

      {importedDomains.length > 0 && (
        <div className="mt-5 space-y-3">
          <p className="text-sm font-medium text-foreground">
            Imported domains
          </p>

          {importingDomains && (
            <div className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Adding imported domains...
            </div>
          )}

          {!importingDomains &&
            domainResults.map((result) => (
              <div key={result.hostname} className="space-y-2">
                <p className="font-mono text-xs text-foreground">
                  {result.hostname}
                </p>
                {result.instructions ? (
                  <DnsInstructions instructions={result.instructions} />
                ) : (
                  <p className="text-xs text-destructive">
                    Failed to import this domain. Add it manually from the
                    project&apos;s domains settings once deployed.
                  </p>
                )}
              </div>
            ))}

          {!importingDomains && (
            <p className="text-xs leading-[1.4] text-muted-foreground">
              Orbit can&apos;t take over DNS automatically — point each
              hostname at Orbit using the records above once you&apos;re
              ready to cut over.
            </p>
          )}
        </div>
      )}

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
