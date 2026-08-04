import { cn } from "../../lib/utils";

function initialsOf(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

interface AvatarProps {
  username: string;
  className?: string;
}

export default function Avatar({ username, className = "" }: AvatarProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center border border-border bg-surface-elevated text-[11px] font-bold text-accent",
        className,
      )}
    >
      {initialsOf(username)}
    </span>
  );
}
