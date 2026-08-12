"use client";

import { useUIStore } from "@/lib/store";
import { SectionCard } from "@/components/shared/section-card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export function ProfileSection() {
  const { userProfile: user } = useUIStore();

  if (!user) return null;

  return (
    <SectionCard title="Profile">
      <div className="flex items-center gap-4">
        <Avatar size="lg">
          {user.avatarUrl && (
            <AvatarImage src={user.avatarUrl} alt={user.githubUsername} />
          )}
          <AvatarFallback>
            {user.githubUsername.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium text-foreground">
            {user.githubUsername}
          </p>
          <p className="text-xs text-muted-foreground">
            {user.email ?? "No email on file"}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-2 border-t border-border pt-5">
        <div className="flex items-center gap-3">
          <span className="w-28 text-xs text-muted-foreground">
            GitHub User ID
          </span>
          <span className="text-sm font-mono text-foreground">
            {user.githubUserId}
          </span>
        </div>
      </div>
    </SectionCard>
  );
}
