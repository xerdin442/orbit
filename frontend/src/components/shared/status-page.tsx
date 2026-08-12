import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

interface StatusPageAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface StatusPageProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action: StatusPageAction;
}

export function StatusPage({
  icon: Icon,
  title,
  description,
  action,
}: StatusPageProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-xl bg-card border border-border p-8 shadow-sm">
        <div className="flex flex-col items-center gap-6 text-center">
          <Logo className="text-3xl text-foreground" />

          <div className="flex flex-col items-center gap-2.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Icon
                className="size-8 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            <h1 className="text-2xl font-medium text-foreground">{title}</h1>
            <p className="max-w-xs text-sm text-muted-foreground">
              {description}
            </p>
          </div>

          {action.href ? (
            <Link
              href={action.href}
              className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
            >
              {action.label}
            </Link>
          ) : (
            <Button size="lg" className="w-full" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
