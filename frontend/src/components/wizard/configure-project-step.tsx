"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, ArrowLeft, FileText } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingButton } from "@/components/shared/loading-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/shared/skeleton";
import {
  configureProjectSchema,
  type ConfigureProjectFormInput,
  type ConfigureProjectFormOutput,
} from "@/lib/schema";
import type {
  GitHubInstallation,
  GitHubRepository,
  Project,
  VariableEntry,
} from "@/lib/types";
import { ENV_FILENAME_PATTERN, parseEnvFile } from "@/lib/utils";

interface ConfigureProjectPrefill {
  defaultBranch: string | null;
  buildDirectory?: string;
  startCommand?: string;
  envVars: VariableEntry[];
}

interface ConfigureProjectStepProps {
  installation: GitHubInstallation;
  repository: GitHubRepository;
  prefill?: ConfigureProjectPrefill;
  onCreated: (
    project: Project,
    environmentId: string,
    envVarCount: number,
  ) => void;
  onBack: () => void;
}

export function ConfigureProjectStep({
  installation,
  repository,
  prefill,
  onCreated,
  onBack,
}: ConfigureProjectStepProps) {
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: branches, isLoading: branchesLoading } = useQuery({
    queryKey: [
      "github",
      "branches",
      installation.installationId,
      repository.full_name,
    ],
    queryFn: () =>
      api.github.branches(installation.installationId, repository.full_name),
  });

  const form = useForm<
    ConfigureProjectFormInput,
    unknown,
    ConfigureProjectFormOutput
  >({
    resolver: zodResolver(configureProjectSchema),
    mode: "onBlur",
    defaultValues: {
      name: repository.name.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
      defaultBranch: "",
      healthCheck: false,
      healthCheckPort: 3000,
      healthCheckPath: "/health",
      healthCheckTimeout: 60,
      buildDirectory: prefill?.buildDirectory ?? "",
      startCommand: prefill?.startCommand ?? "",
      envVars: prefill?.envVars ?? [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "envVars",
  });

  const handleImportEnv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ENV_FILENAME_PATTERN.test(file.name)) {
      toast.error(`"${file.name}" doesn't look like an .env file`);
      return;
    }

    let parsed: VariableEntry[];
    try {
      parsed = parseEnvFile(await file.text());
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to parse "${file.name}"`,
      );
      return;
    }

    if (parsed.length === 0) {
      toast.error(`No variables found in "${file.name}"`);
      return;
    }

    append(parsed);
    toast.success(
      `Imported ${parsed.length} variable${parsed.length > 1 ? "s" : ""} from ${file.name}`,
    );
  };

  useEffect(() => {
    if (!branches || branches.length === 0 || form.getValues("defaultBranch")) {
      return;
    }

    const preferred =
      prefill?.defaultBranch &&
      branches.some((b) => b.name === prefill.defaultBranch)
        ? prefill.defaultBranch
        : branches[0].name;

    form.setValue("defaultBranch", preferred);
  }, [branches, form, prefill]);

  const healthCheckEnabled = useWatch({
    control: form.control,
    name: "healthCheck",
  });
  const selectedBranch = useWatch({
    control: form.control,
    name: "defaultBranch",
  });

  const onSubmit = async (values: ConfigureProjectFormOutput) => {
    setSubmitting(true);
    try {
      const envVars = values.envVars.reduce<Record<string, string>>(
        (acc, v) => {
          if (v.key) acc[v.key] = v.value;
          return acc;
        },
        {},
      );

      const { project, environmentId } = await api.projects.create({
        name: values.name,
        repositoryUrl: `https://github.com/${repository.full_name}`,
        defaultBranch: values.defaultBranch,
        installationId: installation.installationId,
        healthCheck: values.healthCheck,
        ...(values.healthCheck
          ? {
              healthCheckPort: values.healthCheckPort,
              healthCheckPath: values.healthCheckPath,
              healthCheckTimeout: values.healthCheckTimeout,
            }
          : {}),
        ...(Object.keys(envVars).length > 0 ? { envVars } : {}),
        ...(values.buildDirectory?.trim()
          ? { buildDirectory: values.buildDirectory.trim() }
          : {}),
        ...(values.startCommand?.trim()
          ? { startCommand: values.startCommand.trim() }
          : {}),
      });

      onCreated(project, environmentId, Object.keys(envVars).length);
      toast.success(`Project "${project.name}" created successfully`);
    } catch {
      // error toast already surfaced by the API client
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SectionCard
      title="Configure Project"
      description={`Set up ${repository.full_name} for deployment`}
      actions={
        <Button variant="ghost" size="sm" className="text-xs" onClick={onBack}>
          <ArrowLeft className="size-3.5" />
          Change repository
        </Button>
      }
    >
      {prefill && (
        <p className="mb-5 rounded-lg border border-blue-500/20 bg-blue-500/8 px-3 py-2 text-[0.8125rem] text-blue-400 leading-normal tracking-[-0.01em]">
          Branch, build settings, and environment variables were pre-filled from
          your import. Review before creating the project.
        </p>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-[0.8125rem] text-muted-foreground">
            Project name
          </label>
          <Input
            {...form.register("name")}
            onChange={(e) =>
              form.setValue("name", e.target.value.toLowerCase(), {
                shouldValidate: true,
              })
            }
            placeholder="my-project"
          />
          {form.formState.errors.name && (
            <p className="text-xs text-destructive">
              {form.formState.errors.name.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-[0.8125rem] text-muted-foreground">
            Default branch
          </label>
          {branchesLoading ? (
            <Skeleton className="h-8 w-full bg-input" />
          ) : (
            <Select
              value={selectedBranch}
              onValueChange={(v) =>
                v && form.setValue("defaultBranch", v, { shouldValidate: true })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {(branches ?? []).map((b) => (
                  <SelectItem key={b.name} value={b.name}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {form.formState.errors.defaultBranch && (
            <p className="text-xs text-destructive">
              {form.formState.errors.defaultBranch.message}
            </p>
          )}
        </div>

        <div className="space-y-3 rounded-lg border border-border p-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <Checkbox
              checked={healthCheckEnabled}
              onCheckedChange={(checked) =>
                form.setValue("healthCheck", checked)
              }
            />
            Enable health checks
          </label>
          <p className="text-[0.8125rem] tracking-[-0.015em] text-muted-foreground -mt-1.25">
            If a health check port isn&apos;t configured, the application port
            is auto-detected from a PORT variable, or defaults to 3000.
          </p>

          {healthCheckEnabled && (
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="space-y-1.5">
                <label className="text-[0.8125rem] text-muted-foreground">
                  Port
                </label>
                <Input type="number" {...form.register("healthCheckPort")} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[0.8125rem] text-muted-foreground">
                  Path
                </label>
                <Input {...form.register("healthCheckPath")} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[0.8125rem] text-muted-foreground">
                  Timeout (s)
                </label>
                <Input type="number" {...form.register("healthCheckTimeout")} />
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-lg border border-border p-3">
          <div className="space-y-1.5">
            <label className="text-[0.8125rem] text-muted-foreground">
              Build directory
            </label>
            <Input
              {...form.register("buildDirectory")}
              placeholder="e.g. apps/web"
              className="font-mono"
            />
            {form.formState.errors.buildDirectory && (
              <p className="text-xs text-destructive">
                {form.formState.errors.buildDirectory.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-[0.8125rem] text-muted-foreground">
              Start command
            </label>
            <Input
              {...form.register("startCommand")}
              placeholder="Auto-detected if left blank"
              className="font-mono"
            />
          </div>
        </div>

        <div className="space-y-3.5 px-1">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Environment variables</label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleImportEnv}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileText className="size-3" />
                Import
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => append({ key: "", value: "" })}
              >
                <Plus className="size-3.25" />
                ADD
              </Button>
            </div>
          </div>
          {fields.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No environment variables added.
            </p>
          )}
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-2">
              <Input
                placeholder="KEY"
                className="font-mono"
                {...form.register(`envVars.${index}.key`)}
              />
              <Input
                placeholder="value"
                className="font-mono"
                {...form.register(`envVars.${index}.value`)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Remove variable"
                onClick={() => remove(index)}
              >
                <Trash2 className="size-3.5 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>

        <LoadingButton
          type="submit"
          size="lg"
          loading={submitting}
          className="w-full mt-1"
        >
          Create Project
        </LoadingButton>
      </form>
    </SectionCard>
  );
}
