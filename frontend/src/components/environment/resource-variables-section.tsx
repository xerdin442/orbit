"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Database, Eye, EyeOff, Info } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { CopyToClipboardButton } from "@/components/shared/copy-to-clipboard-button";
import { Skeleton } from "@/components/shared/skeleton";
import { api } from "@/lib/api";
import { cn, maskValue } from "@/lib/utils";

interface ResourceVariablesSectionProps {
  environmentId: string;
}

export function ResourceVariablesSection({
  environmentId,
}: ResourceVariablesSectionProps) {
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const { data: resources, isLoading } = useQuery({
    queryKey: ["resources", environmentId],
    queryFn: () => api.resources.list(environmentId),
  });

  const toggleReveal = (rowKey: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  };

  const resourcesWithCredentials = (resources ?? []).filter(
    (r) => r.credentials && Object.keys(r.credentials).length > 0,
  );

  if (!isLoading && resourcesWithCredentials.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-6">
      <CollapsibleTrigger
        render={
          <button className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted" />
        }
      >
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Database className="size-4 text-muted-foreground" />
          Resource Variables
        </span>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform duration-250",
            open && "rotate-180",
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-3 pt-3">
        <div className="flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/8 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0 text-blue-400" />
          These variables are generated and managed by their linked resources.
          They&apos;re injected automatically and can&apos;t be edited here.
        </div>

        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {!isLoading &&
          resourcesWithCredentials.map((resource) => (
            <div
              key={resource.id}
              className="rounded-lg border border-border p-3"
            >
              <p className="mb-2.5 text-xs font-medium text-foreground">
                {resource.name}{" "}
                <span className="text-muted-foreground capitalize">
                  ({resource.type})
                </span>
              </p>
              <div className="space-y-1.25">
                {Object.entries(resource.credentials!).map(([key, value]) => {
                  const rowKey = `${resource.id}-${key}`;
                  const isRevealed = revealed.has(rowKey);
                  return (
                    <div
                      key={rowKey}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span className="w-40 shrink-0 truncate font-mono text-muted-foreground">
                        {key}
                      </span>
                      <span className="flex-1 truncate font-mono text-foreground">
                        {isRevealed ? value : maskValue(value)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => toggleReveal(rowKey)}
                      >
                        {isRevealed ? (
                          <EyeOff className="size-3.5" />
                        ) : (
                          <Eye className="size-3.5" />
                        )}
                      </Button>
                      <CopyToClipboardButton text={value} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
