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

const AUTO_SCROLL_DURATION_MS = 1500;
const ANIMATION_MIN_DISTANCE_PX = 24;

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function TerminalViewer({
  lines,
  autoScroll = true,
  className,
}: TerminalViewerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    setHasOverflow(el.scrollHeight > el.clientHeight);
  }, [lines]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !autoScroll) return;

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const target = el.scrollHeight - el.clientHeight;
    const start = el.scrollTop;
    const distance = target - start;

    if (distance <= ANIMATION_MIN_DISTANCE_PX) {
      el.scrollTop = target;
      return;
    }

    const startTime = performance.now();

    const step = (now: number) => {
      const progress = Math.min((now - startTime) / AUTO_SCROLL_DURATION_MS, 1);
      el.scrollTop = start + distance * easeInOutQuad(progress);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(step);
      } else {
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [lines, autoScroll, hasOverflow]);

  return (
    <div
      ref={ref}
      className={cn(
        "h-full overflow-auto rounded-xs bg-black p-4 font-mono text-[0.8125rem] custom-scrollbar",
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
