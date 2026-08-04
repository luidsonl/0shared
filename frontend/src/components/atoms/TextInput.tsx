import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type TextInputProps = InputHTMLAttributes<HTMLInputElement>;

export default function TextInput({ className = "", ...props }: TextInputProps) {
  return (
    <input
      className={cn(
        "h-9 w-full border border-border bg-surface px-3 text-sm text-foreground",
        "placeholder:text-muted",
        "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent",
        className,
      )}
      {...props}
    />
  );
}
