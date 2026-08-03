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

export function TopNav() {
  const { selectedProject, selectedEnvironment, setSelectedEnvironment } =
    useUIStore();

  const { data: environments } = useQuery({
    queryKey: ["environments", selectedProject?.id],
    queryFn: () =>
      selectedProject ? api.environments.list(selectedProject.id) : null,
    enabled: !!selectedProject,
  });

  return (
    <header className="flex items-center gap-3 h-12 px-4 border-b border-border bg-background shrink-0">
      <span className="text-sm font-medium text-foreground">
        {selectedProject?.name ?? "Orbit"}
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
    </header>
  );
}
