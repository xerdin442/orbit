import { create } from "zustand";
import type { Project, Environment } from "@/lib/types";

interface UIState {
  sidebarCollapsed: boolean;
  selectedProject: Project | null;
  selectedEnvironment: Environment | null;

  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSelectedProject: (project: Project | null) => void;
  setSelectedEnvironment: (env: Environment | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  selectedProject: null,
  selectedEnvironment: null,

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setSelectedProject: (project) =>
    set({ selectedProject: project, selectedEnvironment: null }),
  setSelectedEnvironment: (env) => set({ selectedEnvironment: env }),
}));
