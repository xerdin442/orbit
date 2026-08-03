import { cn } from "@/lib/utils";

interface CodeBlockProps {
  children: string;
  className?: string;
}

export function CodeBlock({ children, className }: CodeBlockProps) {
  return (
    <pre
      className={cn(
        "rounded-md bg-muted p-4 text-sm font-mono text-foreground overflow-x-auto",
        className,
      )}
    >
      <code>{children}</code>
    </pre>
  );
}
