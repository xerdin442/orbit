"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";
import { useState, useEffect } from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Search...",
  className,
  disabled = false,
}: SearchBarProps) {
  const [local, setLocal] = useState(value);
  const debounced = useDebounce(local);

  useEffect(() => {
    onChange(debounced);
  }, [debounced, onChange]);

  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
      <input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full h-9 rounded-md border border-input bg-transparent pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}
