"use client";

import { PageHeader } from "@/components/shared/page-header";
import { InstallStatusHandler } from "@/components/settings/install-status-handler";
import { GitInstallationsSection } from "@/components/settings/git-installations-section";
import { SlackSection } from "@/components/settings/slack-section";
import { MigrationsSection } from "@/components/settings/migrations-section";

export default function AccountSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Account Settings" />

      <GitInstallationsSection />
      <SlackSection />
      <MigrationsSection />

      <InstallStatusHandler />
    </div>
  );
}
