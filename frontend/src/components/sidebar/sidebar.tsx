"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/lib/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Logo } from "@/components/logo";
import {
  LayoutDashboard,
  Rocket,
  Database,
  Globe,
  KeyRound,
  Logs,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import type { Project } from "@/lib/types";
import type { User as UserType } from "@/lib/types";
import { clearAuthToken } from "@/lib/api";
import { useState, useRef, useEffect } from "react";
import { ProjectSwitcher } from "./project-switcher";
import { UserSection } from "./user-section";

const navItems = [
  {
    href: (id: string) => `/projects/${id}`,
    label: "Overview",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: (id: string) => `/projects/${id}/deployments`,
    label: "Deployments",
    icon: Rocket,
  },
  {
    href: (id: string) => `/projects/${id}/resources`,
    label: "Resources",
    icon: Database,
  },
  {
    href: (id: string) => `/projects/${id}/domains`,
    label: "Domains",
    icon: Globe,
  },
  {
    href: (id: string) => `/projects/${id}/environment-variables`,
    label: "Environment Variables",
    icon: KeyRound,
  },
  {
    href: (id: string) => `/projects/${id}/logs`,
    label: "Logs",
    icon: Logs,
  },
  {
    href: (id: string) => `/projects/${id}/settings`,
    label: "Settings",
    icon: Settings,
  },
];

function getProjectIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/projects\/([^/]+)/);
  return match?.[1] ?? null;
}

interface SidebarProps {
  projects: Project[];
  user: UserType;
}

export function Sidebar({ projects, user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    sidebarCollapsed,
    toggleSidebar,
    selectedProject,
    setSelectedProject,
  } = useUIStore();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const urlProjectId = getProjectIdFromPath(pathname);
  const projectId = urlProjectId ?? selectedProject?.id;

  const handleLogout = () => {
    clearAuthToken();
    window.location.href = "/login";
  };

  const handleNewProject = () => {
    router.push("/projects/new");
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setUserMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!urlProjectId) return;
    if (urlProjectId !== selectedProject?.id) {
      const project = projects.find((p) => p.id === urlProjectId);
      if (project) setSelectedProject(project);
    }
  }, [urlProjectId, projects, selectedProject, setSelectedProject]);

  return (
    <TooltipProvider delay={0}>
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-full flex-col bg-sidebar border-r border-sidebar-border transition-all duration-200",
          sidebarCollapsed ? "w-16" : "w-60",
        )}
      >
        <div className="flex items-center gap-2 p-3">
          {!sidebarCollapsed && (
            <Link href="/projects" className="flex-1 min-w-0">
              <Logo className="text-lg text-sidebar-foreground truncate" />
            </Link>
          )}
          <button
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="shrink-0 cursor-pointer inline-flex items-center justify-center h-8 w-8 rounded-md text-sidebar-foreground hover:bg-sidebar-accent"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </button>
        </div>

        {!sidebarCollapsed && (
          <div className="px-3 pb-2">
            <ProjectSwitcher
              projects={projects}
              selectedProject={selectedProject}
              onSelect={(p) => {
                setSelectedProject(p);
                router.push(`/projects/${p.id}`);
              }}
              onNewProject={handleNewProject}
            />
          </div>
        )}
        {sidebarCollapsed && <Separator className="bg-sidebar-border" />}

        <ScrollArea className="flex-1 px-3 py-2">
          <nav
            className={cn("flex flex-col gap-0.5", sidebarCollapsed && "px-0")}
          >
            {projectId &&
              navItems.map((item) => {
                const href = item.href(projectId);
                const isActive = item.exact
                  ? pathname === href || pathname === href + "/"
                  : pathname === href || pathname.startsWith(href + "/");
                const Icon = item.icon;

                if (sidebarCollapsed) {
                  return (
                    <Tooltip key={item.label}>
                      <TooltipTrigger className="flex items-center justify-center h-9 w-9 mx-auto rounded-md text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
                        <Link
                          href={href}
                          className={cn(
                            "flex items-center justify-center",
                            isActive && "text-sidebar-primary",
                          )}
                        >
                          <Icon className="size-4" />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  );
                }

                return (
                  <Link
                    key={item.label}
                    href={href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-colors",
                      isActive && "bg-sidebar-accent text-sidebar-primary",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
          </nav>
        </ScrollArea>

        <Separator className="bg-sidebar-border" />

        <div className="p-3">
          <UserSection
            user={user}
            collapsed={sidebarCollapsed}
            menuOpen={userMenuOpen}
            onToggleMenu={() => setUserMenuOpen((v) => !v)}
            onAccountSettings={() => {
              router.push("/settings");
              setUserMenuOpen(false);
            }}
            onLogout={handleLogout}
            menuRef={menuRef}
          />
        </div>
      </aside>
    </TooltipProvider>
  );
}
