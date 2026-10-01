"use client";

import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface TerminalViewerProps {
  lines: {
    text: string;
    className?: string;
  }[];
  autoScroll?: boolean;
  className?: string;
}

export function TerminalViewer({
  lines,
  autoScroll = true,
  className,
}: TerminalViewerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    setHasOverflow(el.scrollHeight > el.clientHeight);

    if (autoScroll) {
      el.scrollTop = el.scrollHeight;
    }
  }, [lines, autoScroll]);

  return (
    <div
      ref={ref}
      className={cn(
        "h-full overflow-auto rounded-xs bg-black p-4 font-mono text-[0.8125rem]",
        "scrollbar-thin [scrollbar-color:rgba(255,255,255,0.15)_transparent]",
        "[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent",
        "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15 [&::-webkit-scrollbar-thumb:hover]:bg-white/25",
        className,
      )}
    >
      {lines.length === 0 ? (
        <span className="text-muted-foreground">No output</span>
      ) : (
        <>
          {lines.map((line, i) => (
            <div
              key={i}
              className={cn(
                "leading-6 whitespace-pre-wrap break-all",
                line.className,
              )}
            >
              {line.text}
            </div>
          ))}
          {hasOverflow && <div className="h-4" aria-hidden />}
        </>
      )}
    </div>
  );
}
