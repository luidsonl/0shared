import { cn } from "../../lib/utils";

interface LogoProps {
  className?: string;
}

/**
 * 0shared mark: a zero-lens with a slashed-zero diagonal and a
 * magnifying-glass handle — a zero that searches.
 * The lens/handle use `currentColor`; the slash is rendered in the accent color.
 */
export function Logo({ className = "" }: LogoProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn("block", className)}
      role="img"
      aria-label="0shared"
    >
      <circle cx="14" cy="14" r="9" stroke="currentColor" strokeWidth="2.5" />
      <path d="M8 20 20 8" className="stroke-accent" strokeWidth="2.5" />
      <path d="m21 21 7 7" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );
}

export function Wordmark({ className = "" }: LogoProps) {
  return (
    <span className={cn("font-bold tracking-tight", className)}>
      <span className="text-accent">0</span>shared
    </span>
  );
}
