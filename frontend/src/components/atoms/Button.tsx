import type { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap border text-xs font-semibold uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "border-primary bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary:
          "border-border bg-surface text-foreground hover:border-muted hover:bg-surface-elevated",
        ghost: "border-transparent bg-transparent text-muted hover:bg-surface-elevated hover:text-foreground",
        danger: "border-danger/40 bg-danger/10 text-danger hover:bg-danger/25",
        accent: "border-accent bg-accent text-background hover:bg-accent-2",
      },
      size: {
        sm: "h-7 px-3 text-[11px]",
        md: "h-9 px-4",
        lg: "h-11 px-6 text-sm",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export default function Button({
  type = "button",
  className = "",
  variant,
  size,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
