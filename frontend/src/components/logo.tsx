import localFont from "next/font/local";
import { ScanBox } from "lucide-react";
import { cn } from "@/lib/utils";

const arsenica = localFont({
  src: "../../public/fonts/arsenica-medium.ttf",
  display: "swap",
});

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 tracking-[0.015em]",
        arsenica.className,
        className,
      )}
    >
      <ScanBox className="text-primary" size="0.85em" strokeWidth={2.5} />
      Orbit
    </span>
  );
}
