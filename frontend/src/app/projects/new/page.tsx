"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Logo } from "@/components/logo";
import { WizardProgress } from "@/components/wizard/wizard-progress";
import { SelectImportSourceStep } from "@/components/wizard/select-import-source-step";
import { SelectExternalProjectStep } from "@/components/wizard/select-external-project-step";
import { SelectInstallationStep } from "@/components/wizard/select-installation-step";
import { SelectRepositoryStep } from "@/components/wizard/select-repository-step";
import { ConfigureProjectStep } from "@/components/wizard/configure-project-step";
import { AttachResourcesStep } from "@/components/wizard/attach-resources-step";
import { DeploySummaryStep } from "@/components/wizard/deploy-summary-step";
import type {
  ExternalProjectDetail,
  ExternalProvider,
  GitHubInstallation,
  GitHubRepository,
  Project,
} from "@/lib/types";

const STEP_LABELS = [
  "Source",
  "Installation",
  "Repository",
  "Configure",
  "Resources",
  "Deploy",
];

interface WizardState {
  step: number;
  importProvider: ExternalProvider | null;
  importedDetail: ExternalProjectDetail | null;
  installation: GitHubInstallation | null;
  repository: GitHubRepository | null;
  project: Project | null;
  environmentId: string | null;
  envVarCount: number;
  resourceCount: number;
}

const initialState: WizardState = {
  step: 1,
  importProvider: null,
  importedDetail: null,
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
        {state.step === 1 && !state.importProvider && (
          <SelectImportSourceStep
            onScratch={() => setState((s) => ({ ...s, step: 2 }))}
            onImport={(importProvider) =>
              setState((s) => ({ ...s, importProvider }))
            }
          />
        )}

        {state.step === 1 && state.importProvider && (
          <SelectExternalProjectStep
            provider={state.importProvider}
            onSelect={(importedDetail) =>
              setState((s) => ({ ...s, importedDetail, step: 2 }))
            }
            onBack={() => setState((s) => ({ ...s, importProvider: null }))}
          />
        )}

        {state.step === 2 && (
          <SelectInstallationStep
            prefillRepoFullName={state.importedDetail?.repoFullName ?? null}
            onSelect={(installation) =>
              setState((s) => ({ ...s, installation, step: 3 }))
            }
            onBack={() =>
              setState((s) => ({
                ...s,
                step: 1,
                importProvider: null,
                importedDetail: null,
              }))
            }
          />
        )}

        {state.step === 3 && state.installation && (
          <SelectRepositoryStep
            installation={state.installation}
            prefillRepoFullName={state.importedDetail?.repoFullName ?? null}
            onSelect={(repository) =>
              setState((s) => ({ ...s, repository, step: 4 }))
            }
            onBack={() =>
              setState((s) => ({ ...s, step: 2, installation: null }))
            }
          />
        )}

        {state.step === 4 && state.installation && state.repository && (
          <ConfigureProjectStep
            installation={state.installation}
            repository={state.repository}
            prefill={
              state.importedDetail ? { ...state.importedDetail } : undefined
            }
            onCreated={(project, environmentId, envVarCount) =>
              setState((s) => ({
                ...s,
                project,
                environmentId,
                envVarCount,
                step: 5,
              }))
            }
            onBack={() =>
              setState((s) => ({ ...s, step: 3, repository: null }))
            }
          />
        )}

        {state.step === 5 && state.environmentId && (
          <AttachResourcesStep
            environmentId={state.environmentId}
            onDone={(resourceCount) =>
              setState((s) => ({ ...s, resourceCount, step: 6 }))
            }
          />
        )}

        {state.step === 6 &&
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
              importedDomains={state.importedDetail?.domains ?? []}
            />
          )}
      </main>
    </div>
  );
}
