"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Database, Info } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { credentialKeySchema } from "@/lib/schema";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/shared/loading-button";
import { Skeleton } from "@/components/shared/skeleton";
import type { ResourceType } from "@/lib/types";

const RESOURCE_TYPES: { type: ResourceType; label: string }[] = [
  { type: "postgres", label: "PostgreSQL" },
  { type: "mysql", label: "MySQL" },
  { type: "redis", label: "Redis" },
  { type: "mongo", label: "MongoDB" },
];

interface AttachResourcesStepProps {
  environmentId: string;
  onDone: (resourceCount: number) => void;
}

export function AttachResourcesStep({
  environmentId,
  onDone,
}: AttachResourcesStepProps) {
  const [selected, setSelected] = useState<Set<ResourceType>>(new Set());
  const [keyOverrides, setKeyOverrides] = useState<
    Partial<Record<ResourceType, Record<string, string>>>
  >({});
  const [keyErrors, setKeyErrors] = useState<
    Partial<Record<ResourceType, Record<string, string>>>
  >({});
  const [submitting, setSubmitting] = useState(false);

  const { data: defaults, isLoading } = useQuery({
    queryKey: ["resources", "defaults"],
    queryFn: () => api.resources.defaults(RESOURCE_TYPES.map((r) => r.type)),
  });

  const toggleType = (type: ResourceType) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const updateKey = (type: ResourceType, defaultKey: string, value: string) => {
    setKeyOverrides((prev) => ({
      ...prev,
      [type]: { ...prev[type], [defaultKey]: value },
    }));

    const result = credentialKeySchema(defaultKey).safeParse(value);
    setKeyErrors((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        [defaultKey]: result.success ? "" : result.error.issues[0].message,
      },
    }));
  };

  const hasInvalidKeys = Array.from(selected).some((type) =>
    Object.values(keyErrors[type] ?? {}).some((message) => !!message),
  );

  const handleAttach = async () => {
    setSubmitting(true);
    try {
      for (const type of selected) {
        const keys = defaults?.[type] ?? [];
        const credentials = keys.reduce<Record<string, string>>((acc, k) => {
          acc[k.key] = keyOverrides[type]?.[k.key] || k.key;
          return acc;
        }, {});

        await api.resources.create(environmentId, {
          type,
          name: type,
          credentials,
        });
      }

      toast.success(
        `${selected.size} resource${selected.size > 1 ? "s" : ""} queued for provisioning`,
      );
      onDone(selected.size);
    } catch {
      // error toast already surfaced by the API client
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SectionCard
      title="Attach Resources"
      description="Attach any managed databases your app needs. Optionally edit the connection variable defaults to match your setup"
    >
      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      )}

      {!isLoading && (
        <div className="space-y-3">
          {RESOURCE_TYPES.map(({ type, label }) => {
            const keys = defaults?.[type] ?? [];
            const isSelected = selected.has(type);
            return (
              <div key={type} className="rounded-lg border border-border p-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleType(type)}
                  />
                  <Database className="size-4 text-muted-foreground" />
                  {label}
                </label>

                {isSelected && keys.length > 0 && (
                  <div className="mt-3 space-y-2 pl-6">
                    {keys.map((k) => {
                      const error = keyErrors[type]?.[k.key];
                      return (
                        <div key={k.key} className="space-y-1.25">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-40 shrink-0 text-xs text-muted-foreground"
                              title={k.description}
                            >
                              {k.description}
                            </span>
                            <Input
                              className={cn(
                                "font-mono text-xs",
                                error && "border-destructive",
                              )}
                              value={keyOverrides[type]?.[k.key] ?? k.key}
                              onChange={(e) =>
                                updateKey(type, k.key, e.target.value)
                              }
                            />
                          </div>
                          {error && (
                            <p className="pl-42 text-xs text-destructive">
                              {error}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selected.size > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/8 p-3 text-sm text-blue-400">
          <Info className="mt-0.5 size-5 shrink-0" />
          <p>
            The connection variables for the selected resources will be injected
            directly into your application container as environment variables.
          </p>
        </div>
      )}

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => onDone(0)}
          disabled={selected.size > 0 || submitting}
        >
          Skip
        </Button>
        <LoadingButton
          onClick={handleAttach}
          loading={submitting}
          disabled={selected.size === 0 || hasInvalidKeys}
        >
          Attach{selected.size > 0 ? ` (${selected.size})` : ""}
        </LoadingButton>
      </div>
    </SectionCard>
  );
}
