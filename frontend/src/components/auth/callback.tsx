"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setAuthToken } from "@/lib/api";

export function AuthCallback({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;

    const token = searchParams.get("token");
    if (token) {
      handled.current = true;
      setAuthToken(token);

      const params = new URLSearchParams(searchParams);
      params.delete("token");
      params.delete("source");
      const qs = params.toString();
      router.replace(`/${qs ? `?${qs}` : ""}`);
    }
  }, [searchParams, router]);

  return <>{children}</>;
}
