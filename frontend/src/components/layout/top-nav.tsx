"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useUIStore } from "@/lib/store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Plus } from "lucide-react";

export function TopNav() {
  const { selectedProject, selectedEnvironment, setSelectedEnvironment } =
    useUIStore();
  const initialized = useRef(false);
  const pathname = usePathname();
  const router = useRouter();

  const { data: environments } = useQuery({
    queryKey: ["environments", selectedProject?.id],
    queryFn: () =>
      selectedProject ? api.environments.list(selectedProject.id) : null,
    enabled: !!selectedProject,
  });

  useEffect(() => {
    if (
      environments &&
      environments.length > 0 &&
      !selectedEnvironment &&
      !initialized.current
    ) {
      initialized.current = true;
      const env =
        environments.find((e) => e.name === "production") ?? environments[0];
      setSelectedEnvironment(env);
    }
  }, [environments, selectedEnvironment, setSelectedEnvironment]);

  useEffect(() => {
    initialized.current = false;
  }, [selectedProject?.id]);

  return (
    <header className="flex items-center gap-3 h-16 px-6 border-b border-border bg-background shrink-0">
      <span className="text-sm font-medium text-foreground">
        {selectedProject?.name ?? ""}
      </span>

      {selectedProject && environments && environments.length > 0 && (
        <Select
          value={selectedEnvironment?.id ?? ""}
          onValueChange={(value) => {
            const env = environments.find((e) => e.id === value);
            if (env) setSelectedEnvironment(env);
          }}
        >
          <SelectTrigger
            className="h-7 text-xs bg-muted text-muted-foreground border-0"
            size="sm"
          >
            <span>{selectedEnvironment?.name ?? "Select env"}</span>
          </SelectTrigger>
          <SelectContent className="p-1">
            {environments.map((env) => (
              <SelectItem key={env.id} value={env.id}>
                {env.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="flex-1" />

      {pathname !== "/projects" && (
        <Button
          onClick={() => router.push("/projects/new")}
          size="sm"
          className="text-[0.8125rem]"
        >
          <Plus className="size-3.5" />
          New Project
        </Button>
      )}
    </header>
  );
}
