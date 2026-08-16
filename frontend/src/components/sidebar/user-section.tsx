"use client";

import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { UserRoundCog, LogOut } from "lucide-react";
import type { User as UserType } from "@/lib/types";

interface UserSectionProps {
  user: UserType;
  collapsed: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onAccountSettings: () => void;
  onLogout: () => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
}

export function UserSection({
  user,
  collapsed,
  menuOpen,
  onToggleMenu,
  onAccountSettings,
  onLogout,
  menuRef,
}: UserSectionProps) {
  const { avatarUrl, email, githubUsername: username } = user;

  const avatar = (
    <Avatar className="shrink-0">
      {avatarUrl && <AvatarImage src={avatarUrl} alt={username} />}
      <AvatarFallback>{username.slice(0, 1).toUpperCase()}</AvatarFallback>
    </Avatar>
  );

  if (collapsed) {
    return (
      <div className="relative flex items-center justify-center" ref={menuRef}>
        <Tooltip>
          <TooltipTrigger
            onClick={onToggleMenu}
            aria-label={username}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center justify-center cursor-pointer p-1.5 mx-auto rounded-md hover:bg-sidebar-accent transition-colors"
          >
            {avatar}
          </TooltipTrigger>
          <TooltipContent side="right">{username}</TooltipContent>
        </Tooltip>

        {menuOpen && (
          <div className="absolute bottom-full mb-1 left-0 right-0 rounded-md bg-popover border border-border shadow-sm p-1 flex flex-col items-center">
            <Tooltip>
              <TooltipTrigger
                onClick={onAccountSettings}
                className="flex items-center justify-center h-9 w-9 rounded-md text-popover-foreground hover:bg-accent transition-colors"
              >
                <UserRoundCog className="size-4 cursor-pointer" />
              </TooltipTrigger>
              <TooltipContent side="right">Account Settings</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                onClick={onLogout}
                className="flex items-center justify-center h-9 w-9 rounded-md text-popover-foreground hover:bg-accent transition-colors"
              >
                <LogOut className="size-4 cursor-pointer" />
              </TooltipTrigger>
              <TooltipContent side="right">Logout</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={onToggleMenu}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="flex items-center cursor-pointer gap-2.5 px-3 py-2 w-full rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
      >
        {avatar}
        <div className="flex-1 min-w-0 text-left">
          <p className="truncate text-sidebar-foreground">{username}</p>
          <p className="truncate text-xs font-normal text-sidebar-foreground/60">
            {email ?? "No email on file"}
          </p>
        </div>
      </button>

      {menuOpen && (
        <div className="absolute bottom-full mb-1 left-0 right-0 rounded-md bg-popover border border-border shadow-sm p-1">
          <Link
            href="/settings"
            onClick={onAccountSettings}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-sm text-sm text-popover-foreground hover:bg-accent transition-colors"
          >
            <UserRoundCog className="size-4" />
            Account Settings
          </Link>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 cursor-pointer w-full px-3 py-2 rounded-sm text-sm text-popover-foreground hover:bg-accent transition-colors"
          >
            <LogOut className="size-4" />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
