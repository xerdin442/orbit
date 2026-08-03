import { cn } from "@/lib/utils";

interface PageActionsProps {
  children: React.ReactNode;
  className?: string;
}

export function PageActions({ children, className }: PageActionsProps) {
  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 flex flex-col gap-2 z-30",
        className,
      )}
    >
      {children}
    </div>
  );
}
