import { cn } from "@/lib/utils";

interface KeyValueItem {
  key: string;
  value: string;
}

interface KeyValueListProps {
  items: KeyValueItem[];
  className?: string;
}

export function KeyValueList({ items, className }: KeyValueListProps) {
  return (
    <div className={cn("space-y-2.5", className)}>
      {items.map((item) => (
        <div
          key={item.key}
          className="flex items-center justify-between gap-8"
        >
          <span className="shrink-0 text-sm text-muted-foreground">
            {item.key}
          </span>
          <span
            className="min-w-0 truncate text-sm font-mono text-foreground"
            title={item.value}
          >
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
