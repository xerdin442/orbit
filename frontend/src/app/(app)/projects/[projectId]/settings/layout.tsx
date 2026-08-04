"use client";

import Link from "next/link";
import { useParams, usePathname, notFound } from "next/navigation";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";

const tabs = [
  { href: "general", label: "General" },
  { href: "git", label: "Git Repository" },
  { href: "environments", label: "Environments" },
  { href: "danger", label: "Danger Zone" },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { projectId } = useParams<{ projectId: string }>();
  const pathname = usePathname();

  if (!projectId) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Project Settings" />

      <div className="border-b border-border">
        <nav className="flex items-center gap-1">
          {tabs.map((tab) => {
            const href = `/projects/${projectId}/settings/${tab.href}`;
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={tab.href}
                href={href}
                className={cn(
                  "px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors border-b-2 border-transparent -mb-px",
                  active && "text-foreground border-primary",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {children}
    </div>
  );
}
