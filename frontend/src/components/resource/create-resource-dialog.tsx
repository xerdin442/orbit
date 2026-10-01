"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn, RESOURCE_TYPE_LABELS } from "@/lib/utils";
import { credentialKeySchema, resourceNameSchema } from "@/lib/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingButton } from "@/components/shared/loading-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/shared/skeleton";
import type { ResourceType } from "@/lib/types";

const RESOURCE_TYPES: ResourceType[] = ["postgres", "mysql", "redis", "mongo"];

interface CreateResourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  environmentId: string;
  onCreated: () => void;
}

export function CreateResourceDialog({
  open,
  onOpenChange,
  environmentId,
  onCreated,
}: CreateResourceDialogProps) {
  const [type, setType] = useState<ResourceType>("postgres");
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [keyOverrides, setKeyOverrides] = useState<Record<string, string>>({});
  const [keyErrors, setKeyErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const { data: defaults, isLoading } = useQuery({
    queryKey: ["resources", "defaults", type],
    queryFn: () => api.resources.defaults([type]),
    enabled: open,
  });

  const keys = defaults?.[type] ?? [];

  const reset = () => {
    setType("postgres");
    setName("");
    setNameError("");
    setKeyOverrides({});
    setKeyErrors({});
  };

  const close = (next: boolean) => {
    if (submitting) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const updateName = (value: string) => {
    setName(value);
    const result = resourceNameSchema.safeParse(value);
    setNameError(result.success ? "" : result.error.issues[0].message);
  };

  const updateKey = (defaultKey: string, value: string) => {
    setKeyOverrides((prev) => ({ ...prev, [defaultKey]: value }));
    const result = credentialKeySchema(defaultKey).safeParse(value);
    setKeyErrors((prev) => ({
      ...prev,
      [defaultKey]: result.success ? "" : result.error.issues[0].message,
    }));
  };

  const hasInvalidKeys = Object.values(keyErrors).some((message) => !!message);
  const canSubmit =
    resourceNameSchema.safeParse(name).success && !hasInvalidKeys;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    try {
      const credentials = keys.reduce<Record<string, string>>((acc, k) => {
        acc[k.key] = keyOverrides[k.key] || k.key;
        return acc;
      }, {});

      await api.resources.create(environmentId, {
        type,
        name: name.toLowerCase(),
        credentials,
      });

      toast.success(`Resource "${name.toLowerCase()}" queued for provisioning`);
      onCreated();
      close(false);
    } catch {
      // error toast already surfaced by the API client
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Resource</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[0.8125rem] text-muted-foreground inline-block">
              Type
            </label>
            <Select
              value={type}
              onValueChange={(v) => {
                if (!v) return;
                setType(v as ResourceType);
                setKeyOverrides({});
                setKeyErrors({});
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESOURCE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {RESOURCE_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-[0.8125rem] text-muted-foreground">
              Resource name
            </label>
            <Input
              value={name}
              onChange={(e) => updateName(e.target.value)}
              placeholder="my-database"
              className="font-mono"
              autoFocus
            />
            {nameError && (
              <p className="text-[11px] text-destructive">{nameError}</p>
            )}
          </div>

          {isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          )}

          {!isLoading && keys.length > 0 && (
            <div>
              <label className="text-sm font-medium text-foreground/80">
                Connection variables
              </label>
              {keys.map((k) => {
                const error = keyErrors[k.key];
                return (
                  <div key={k.key} className="space-y-1.25 mt-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-32 shrink-0 truncate text-xs text-muted-foreground"
                        title={k.description}
                      >
                        {k.description}
                      </span>
                      <Input
                        className={cn(
                          "font-mono text-xs",
                          error && "border-destructive",
                        )}
                        value={keyOverrides[k.key] ?? k.key}
                        onChange={(e) => updateKey(k.key, e.target.value)}
                      />
                    </div>
                    {error && (
                      <p className="pl-34 text-[11px] text-destructive">
                        {error}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <LoadingButton
            onClick={handleSubmit}
            loading={submitting}
            disabled={!canSubmit}
          >
            Add Resource
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
