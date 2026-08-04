import { cn } from "../../lib/utils";

interface ProgressProps {
  value: number;
  className?: string;
  label?: string;
}

export default function Progress({ value, className = "", label }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        className="h-1.5 w-full overflow-hidden border border-border bg-surface-elevated"
      >
        <div
          className="h-full bg-accent transition-[width] duration-200"
          style={{ width: `${clamped}%` }}
        />
      </div>
      {label && <span className="shrink-0 text-xs uppercase tracking-widest text-muted">{label}</span>}
    </div>
  );
}
