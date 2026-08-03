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
    <div className={cn("space-y-2", className)}>
      {items.map((item) => (
        <div key={item.key} className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{item.key}</span>
          <span className="text-sm font-mono text-foreground">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
