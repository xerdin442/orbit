"use client";

import { SectionCard } from "@/components/shared/section-card";

export default function DangerZoneSettingsPage() {
  return (
    <SectionCard title="Danger Zone">
      <p className="text-sm text-muted-foreground">
        Destructive project actions will go here.
      </p>
    </SectionCard>
  );
}
