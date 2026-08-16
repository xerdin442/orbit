"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAuthToken } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("token")) return;
    router.replace(getAuthToken() ? "/projects" : "/login");
  }, [router, searchParams]);

  return null;
}
