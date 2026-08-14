"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { InstallErrorDialog } from "@/components/shared/install-error-dialog";

export function InstallStatusHandler() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [githubInstallError, setGithubInstallError] = useState(
    () => searchParams.get("github_install") === "error",
  );
  const [slackInstallError, setSlackInstallError] = useState(
    () => searchParams.get("slack_install") === "error",
  );
  const handledToast = useRef(false);

  useEffect(() => {
    const githubInstall = searchParams.get("github_install");
    const slackInstall = searchParams.get("slack_install");
    if (!githubInstall && !slackInstall) return;

    if (!handledToast.current) {
      handledToast.current = true;

      if (githubInstall === "connected") {
        toast.success("GitHub connected successfully");
        queryClient.invalidateQueries({
          queryKey: ["github", "installations"],
        });
      }

      if (slackInstall === "connected") {
        toast.success("Slack connected successfully");
        queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      }
    }

    const params = new URLSearchParams(searchParams);
    params.delete("github_install");
    params.delete("slack_install");
    const qs = params.toString();
    window.history.replaceState(null, "", `${pathname}${qs ? `?${qs}` : ""}`);
  }, [searchParams, pathname, queryClient]);

  const handleGithubRetry = async () => {
    const url = await api.github.installUrl();
    window.location.href = url;
  };

  const handleSlackRetry = async () => {
    const url = await api.slack.installUrl();
    window.location.href = url;
  };

  return (
    <>
      <InstallErrorDialog
        open={githubInstallError}
        onOpenChange={setGithubInstallError}
        title="GitHub installation failed"
        description="We couldn't complete the GitHub App installation. Please try connecting again."
        onRetry={handleGithubRetry}
      />

      <InstallErrorDialog
        open={slackInstallError}
        onOpenChange={setSlackInstallError}
        title="Slack installation failed"
        description="We couldn't complete the Slack installation. Please try connecting again."
        onRetry={handleSlackRetry}
      />
    </>
  );
}
