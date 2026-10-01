import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string | number;
  description?: string;
  className?: string;
}

export function MetricCard({
  label,
  value,
  description,
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn("rounded-xl border border-border bg-card p-4", className)}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-medium text-foreground mt-1">{value}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      )}
    </div>
  );
}
