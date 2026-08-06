import { cn } from "@/lib/utils";

interface SectionCardProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}

export function SectionCard({
  title,
  description,
  children,
  className,
  actions,
}: SectionCardProps) {
  return (
    <div
      className={cn("rounded-xl border border-border bg-card p-6", className)}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between mb-5">
          <div>
            {title && (
              <h3 className="text-[17px] font-semibold text-foreground">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-xs text-muted-foreground mt-0.75 leading-normal">
                {description}
              </p>
            )}
          </div>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}
