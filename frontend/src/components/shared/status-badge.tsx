import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        ready: "bg-green-500/10 text-green-500",
        pending: "bg-yellow-500/10 text-yellow-500 animate-pulse",
        failed: "bg-red-500/10 text-red-500",
        building: "bg-blue-500/10 text-blue-500 animate-pulse",
        active: "bg-orange-500/10 text-orange-500",
        inactive: "bg-muted text-muted-foreground",
        provisioning: "bg-yellow-500/10 text-yellow-500 animate-pulse",
        unhealthy: "bg-red-500/10 text-red-500",
        verifying: "bg-blue-500/10 text-blue-500 animate-pulse",
        aborted: "bg-muted text-muted-foreground",
        warning: "bg-yellow-500/10 text-yellow-500",
      },
    },
    defaultVariants: {
      variant: "pending",
    },
  },
);

interface StatusBadgeProps extends VariantProps<typeof badgeVariants> {
  className?: string;
  children: React.ReactNode;
}

export function StatusBadge({
  variant = "pending",
  className,
  children,
}: StatusBadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)}>
      {children}
    </span>
  );
}
