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
      router.replace("/projects");
    }
  }, [searchParams, router]);

  return <>{children}</>;
}
