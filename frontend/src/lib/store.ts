import { create } from "zustand";
import type { Project, Environment, User } from "@/lib/types";

interface UIState {
  sidebarCollapsed: boolean;
  selectedProject: Project | null;
  selectedEnvironment: Environment | null;
  userProfile: User | null;

  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSelectedProject: (project: Project | null) => void;
  setSelectedEnvironment: (env: Environment | null) => void;
  setUserProfile: (user: User | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  selectedProject: null,
  selectedEnvironment: null,
  userProfile: null,

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setSelectedProject: (project) =>
    set((state) => ({
      selectedProject: project,
      selectedEnvironment:
        project?.id === state.selectedProject?.id
          ? state.selectedEnvironment
          : null,
    })),
  setSelectedEnvironment: (env) => set({ selectedEnvironment: env }),
  setUserProfile: (user) => set({ userProfile: user }),
}));
