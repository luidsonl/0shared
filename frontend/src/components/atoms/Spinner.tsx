import { cn } from "../../lib/utils";

export default function Spinner({ className = "", label = "Loading..." }: { className?: string; label?: string }) {
  return (
    <div className={cn("flex items-center gap-2 text-muted", className)}>
      <span aria-hidden className="inline-block h-3 w-3 animate-spin border border-muted border-t-accent" />
      <span className="text-xs uppercase tracking-widest">{label}</span>
    </div>
  );
}
