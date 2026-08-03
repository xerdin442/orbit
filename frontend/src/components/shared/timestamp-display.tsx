"use client";

import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface TimestampDisplayProps {
  value: string;
  className?: string;
}

export function TimestampDisplay({ value, className }: TimestampDisplayProps) {
  const [showAbsolute, setShowAbsolute] = useState(false);
  const date = new Date(value);

  return (
    <button
      onClick={() => setShowAbsolute((v) => !v)}
      className={cn(
        "text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer",
        className,
      )}
      title={format(date, "PPpp")}
    >
      {showAbsolute
        ? format(date, "MMM d, yyyy HH:mm")
        : formatDistanceToNow(date, { addSuffix: true })}
    </button>
  );
}
