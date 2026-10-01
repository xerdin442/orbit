"use client";

import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { User, UserRoundCog, LogOut } from "lucide-react";

interface UserSectionProps {
  username: string;
  collapsed: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onAccountSettings: () => void;
  onLogout: () => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
}

export function UserSection({
  username,
  collapsed,
  menuOpen,
  onToggleMenu,
  onAccountSettings,
  onLogout,
  menuRef,
}: UserSectionProps) {
  if (collapsed) {
    return (
      <div className="relative" ref={menuRef}>
        <Tooltip>
          <TooltipTrigger
            onClick={onToggleMenu}
            className="flex items-center justify-center cursor-pointer h-9 w-9 mx-auto rounded-md text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <User className="size-4" />
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
        className="flex items-center cursor-pointer gap-3 px-3 py-2 w-full rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
      >
        <User className="size-4 shrink-0" />
        <span className="flex-1 text-left truncate">{username}</span>
      </button>

      {menuOpen && (
        <div className="absolute bottom-full mb-1 left-0 right-0 rounded-md bg-popover border border-border shadow-sm p-1">
          <Link
            href="/settings"
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
