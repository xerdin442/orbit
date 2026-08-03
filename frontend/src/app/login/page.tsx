"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export default function LoginPage() {
  const handleLogin = async () => {
    const url = await api.auth.githubLoginUrl();
    window.location.href = url;
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-xl bg-card border border-border p-8 shadow-sm">
        <div className="flex flex-col items-center gap-6">
          <Logo className="text-3xl text-foreground" />

          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-2xl font-medium text-foreground">
              A better way to ship software.
            </h1>
            <p className="text-sm text-muted-foreground max-w-xs">
              Build, deploy and manage your applications from a single platform.
            </p>
          </div>

          <Button
            size="lg"
            className="w-full gap-2 tracking-[0.015em]"
            onClick={handleLogin}
          >
            <FontAwesomeIcon icon={faGithub} size="lg" />
            Continue with GitHub
          </Button>
        </div>
      </div>
    </div>
  );
}
