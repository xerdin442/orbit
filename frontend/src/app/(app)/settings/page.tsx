"use client";

import { PageHeader } from "@/components/shared/page-header";
import { InstallStatusHandler } from "@/components/settings/install-status-handler";
import { ProfileSection } from "@/components/settings/profile-section";
import { GitInstallationsSection } from "@/components/settings/git-installations-section";
import { SlackSection } from "@/components/settings/slack-section";

export default function AccountSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Account Settings" />

      <ProfileSection />
      <GitInstallationsSection />
      <SlackSection />

      <InstallStatusHandler />
    </div>
  );
}
