import Image from "next/image";
import { PROVIDER_LABEL, PROVIDER_LOGOS } from "@/lib/utils";
import type { ExternalProvider } from "@/lib/types";

interface ProviderIconProps {
  provider: ExternalProvider;
  className?: string;
}

export function ProviderIcon({ provider, className }: ProviderIconProps) {
  return (
    <Image
      src={PROVIDER_LOGOS[provider]}
      alt={`${PROVIDER_LABEL[provider]} logo`}
      width={provider === "railway" ? 290 : 85}
      height={provider === "railway" ? 290 : 85}
      className={className}
    />
  );
}
