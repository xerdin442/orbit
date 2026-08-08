"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { FolderOpen } from "lucide-react";
import type { Project } from "@/lib/types";

interface ProjectSwitcherProps {
  projects: Project[];
  selectedProject: Project | null;
  onSelect: (p: Project) => void;
  onNewProject: () => void;
}

export function ProjectSwitcher({
  projects,
  selectedProject,
  onSelect,
  onNewProject,
}: ProjectSwitcherProps) {
  if (projects.length === 0) {
    return (
      <button
        onClick={onNewProject}
        className="w-full flex items-center cursor-pointer gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-sidebar-accent transition-colors"
      >
        <FolderOpen className="size-4 shrink-0" />
        New Project
      </button>
    );
  }

  return (
    <Select
      value={selectedProject?.id ?? ""}
      onValueChange={(value) => {
        const project = projects.find((p) => p.id === value);
        if (project) onSelect(project);
      }}
    >
      <SelectTrigger className="w-full bg-sidebar-accent text-sidebar-foreground text-sm h-9 px-3 border-0">
        <span className="truncate">
          {selectedProject?.name ?? "Select project"}
        </span>
      </SelectTrigger>
      <SelectContent className="p-1">
        {projects.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
