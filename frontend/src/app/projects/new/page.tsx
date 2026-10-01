"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Logo } from "@/components/logo";
import { WizardProgress } from "@/components/wizard/wizard-progress";
import { SelectInstallationStep } from "@/components/wizard/select-installation-step";
import { SelectRepositoryStep } from "@/components/wizard/select-repository-step";
import { ConfigureProjectStep } from "@/components/wizard/configure-project-step";
import { AttachResourcesStep } from "@/components/wizard/attach-resources-step";
import { DeploySummaryStep } from "@/components/wizard/deploy-summary-step";
import type {
  GitHubInstallation,
  GitHubRepository,
  Project,
} from "@/lib/types";

const STEP_LABELS = [
  "Installation",
  "Repository",
  "Configure",
  "Resources",
  "Deploy",
];

interface WizardState {
  step: number;
  installation: GitHubInstallation | null;
  repository: GitHubRepository | null;
  project: Project | null;
  environmentId: string | null;
  envVarCount: number;
  resourceCount: number;
}

const initialState: WizardState = {
  step: 1,
  installation: null,
  repository: null,
  project: null,
  environmentId: null,
  envVarCount: 0,
  resourceCount: 0,
};

export default function NewProjectWizardPage() {
  const [state, setState] = useState<WizardState>(initialState);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-5">
        <Logo className="text-lg text-foreground" />
        <WizardProgress steps={STEP_LABELS} currentStep={state.step} />
        <Link
          href="/projects"
          className="flex items-center gap-1 text-sm text-primary transition-colors hover:text-primary/80"
        >
          <X className="size-4" />
          Cancel
        </Link>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10">
        {state.step === 1 && (
          <SelectInstallationStep
            onSelect={(installation) =>
              setState((s) => ({ ...s, installation, step: 2 }))
            }
          />
        )}

        {state.step === 2 && state.installation && (
          <SelectRepositoryStep
            installation={state.installation}
            onSelect={(repository) =>
              setState((s) => ({ ...s, repository, step: 3 }))
            }
            onBack={() =>
              setState((s) => ({ ...s, step: 1, installation: null }))
            }
          />
        )}

        {state.step === 3 && state.installation && state.repository && (
          <ConfigureProjectStep
            installation={state.installation}
            repository={state.repository}
            onCreated={(project, environmentId, envVarCount) =>
              setState((s) => ({
                ...s,
                project,
                environmentId,
                envVarCount,
                step: 4,
              }))
            }
            onBack={() =>
              setState((s) => ({ ...s, step: 2, repository: null }))
            }
          />
        )}

        {state.step === 4 && state.environmentId && (
          <AttachResourcesStep
            environmentId={state.environmentId}
            onDone={(resourceCount) =>
              setState((s) => ({ ...s, resourceCount, step: 5 }))
            }
          />
        )}

        {state.step === 5 &&
          state.project &&
          state.repository &&
          state.environmentId && (
            <DeploySummaryStep
              project={state.project}
              repository={state.repository}
              branch={state.project.source?.defaultBranch ?? ""}
              environmentId={state.environmentId}
              envVarCount={state.envVarCount}
              resourceCount={state.resourceCount}
            />
          )}
      </main>
    </div>
  );
}
