"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { SectionCard } from "@/components/shared/section-card";
import { ProviderIcon } from "@/components/shared/provider-icon";
import type { ExternalProvider } from "@/lib/types";

interface SelectImportSourceStepProps {
  onScratch: () => void;
  onImport: (provider: ExternalProvider) => void;
}

interface SourceOption {
  key: string;
  title: string;
  description: string;
  onClick: () => void;
  provider?: ExternalProvider;
  faIcon?: typeof faGithub;
}

export function SelectImportSourceStep({
  onScratch,
  onImport,
}: SelectImportSourceStepProps) {
  const options: SourceOption[] = [
    {
      key: "scratch",
      title: "Start from scratch",
      description: "Connect a GitHub repository and configure a new project",
      onClick: onScratch,
      faIcon: faGithub,
    },
    {
      key: "vercel",
      title: "Import from Vercel",
      description:
        "Bring in a repo, env vars, and domains from a Vercel project",
      onClick: () => onImport("vercel"),
      provider: "vercel",
    },
    {
      key: "railway",
      title: "Import from Railway",
      description:
        "Bring in a repo, env vars, and domains from a Railway service",
      onClick: () => onImport("railway"),
      provider: "railway",
    },
  ];

  return (
    <SectionCard
      title="New Project"
      description="Start from scratch or import an existing project"
    >
      <div className="space-y-2">
        {options.map((option) => (
          <button
            key={option.key}
            onClick={option.onClick}
            className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
              {option.faIcon ? (
                <FontAwesomeIcon icon={option.faIcon} size="lg" />
              ) : (
                option.provider && (
                  <ProviderIcon
                    provider={option.provider}
                    className="size-5.75"
                  />
                )
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {option.title}
              </p>
              <p className="text-xs text-muted-foreground mt-px">
                {option.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </SectionCard>
  );
}
