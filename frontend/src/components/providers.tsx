"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";
import {
  CircleCheck,
  CircleX,
  Info,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        theme="dark"
        position="top-right"
        closeButton
        style={
          {
            "--toast-close-button-start": "unset",
            "--toast-close-button-end": "0",
            "--toast-close-button-transform": "translate(35%, -35%)",
          } as React.CSSProperties
        }
        icons={{
          success: <CircleCheck className="size-5" />,
          error: <CircleX className="size-5" />,
          info: <Info className="size-5" />,
          warning: <TriangleAlert className="size-5" />,
          loading: <LoaderCircle className="size-5 animate-spin" />,
        }}
        toastOptions={{
          duration: 3500,
          classNames: {
            toast:
              "rounded-lg border border-border bg-popover text-popover-foreground shadow-lg",
            title: "text-sm font-medium",
            description: "!text-muted-foreground",
            closeButton:
              "!h-6 !w-6 !bg-muted !border !border-border !text-muted-foreground hover:!bg-accent hover:!text-foreground [&_svg]:!size-3.5",
            success: "!border-green-500/30 [&_svg]:text-green-500",
            error: "!border-destructive/30 [&_svg]:text-destructive",
            info: "!border-blue-500/30 [&_svg]:text-blue-500",
            warning: "!border-yellow-500/30 [&_svg]:text-yellow-500",
          },
        }}
      />
    </QueryClientProvider>
  );
}
