"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { StatusPage } from "@/components/shared/status-page";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      icon={AlertTriangle}
      title="Something went wrong"
      description="An unexpected error occurred. Please try again."
      action={{ label: "Try again", onClick: reset }}
    />
  );
}
