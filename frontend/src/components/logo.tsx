import localFont from "next/font/local";
import { Ufo3Icon } from "@solar-icons/react/linear/ufo-3";
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
      <Ufo3Icon size={24} color="#ff5600" />
      Orbit
    </span>
  );
}
