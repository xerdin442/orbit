"use client";

import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";

export default function AccountSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Account Settings" />
      <SectionCard title="Profile">
        <p className="text-sm text-muted-foreground">
          Account settings will go here.
        </p>
      </SectionCard>
    </div>
  );
}
