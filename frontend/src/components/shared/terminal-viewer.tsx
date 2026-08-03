"use client";

import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface TerminalViewerProps {
  lines: string[];
  autoScroll?: boolean;
  className?: string;
}

export function TerminalViewer({
  lines,
  autoScroll = true,
  className,
}: TerminalViewerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  return (
    <div
      ref={ref}
      className={cn(
        "h-full overflow-auto rounded-md bg-black p-4 font-mono text-sm text-green-400",
        className,
      )}
    >
      {lines.length === 0 ? (
        <span className="text-muted-foreground">No output</span>
      ) : (
        lines.map((line, i) => (
          <div key={i} className="leading-6 whitespace-pre-wrap break-all">
            {line}
          </div>
        ))
      )}
    </div>
  );
}
