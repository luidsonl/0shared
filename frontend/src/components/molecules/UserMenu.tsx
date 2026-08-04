import { Link } from "react-router-dom";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { ChevronDown, LogOut, User } from "lucide-react";
import Avatar from "../atoms/Avatar";
import { cn } from "../../lib/utils";

interface UserMenuProps {
  username: string;
  userId: string;
  onLogout: () => void;
}

export default function UserMenu({ username, userId, onLogout }: UserMenuProps) {
  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger
        aria-label="User menu"
        className="flex h-8 items-center gap-2 border border-border bg-surface px-2 text-sm text-foreground transition-colors hover:border-muted focus:outline-none focus:ring-1 focus:ring-accent"
      >
        <Avatar username={username} className="h-6 w-6 text-[10px]" />
        <span className="max-w-32 truncate">{username}</span>
        <ChevronDown size={14} className="text-muted" />
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align="end"
          sideOffset={4}
          className={cn(
            "z-50 min-w-44 border border-border bg-background p-1",
            "shadow-[0_12px_24px_rgba(0,0,0,0.5)]",
          )}
        >
          <DropdownMenuPrimitive.Item asChild>
            <Link
              to={`/users/${encodeURIComponent(userId)}`}
              className="flex items-center gap-2 px-2.5 py-2 text-sm text-foreground focus:bg-surface-elevated focus:outline-none"
            >
              <User size={14} className="text-muted" /> My profile
            </Link>
          </DropdownMenuPrimitive.Item>
          <DropdownMenuPrimitive.Separator className="my-1 h-px bg-border" />
          <DropdownMenuPrimitive.Item
            onSelect={onLogout}
            className="flex cursor-pointer items-center gap-2 px-2.5 py-2 text-sm text-danger focus:bg-surface-elevated focus:outline-none"
          >
            <LogOut size={14} /> Log out
          </DropdownMenuPrimitive.Item>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}
