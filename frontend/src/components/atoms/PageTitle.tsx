import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface PageTitleProps {
  children: ReactNode;
  className?: string;
}

export default function PageTitle({ children, className = "" }: PageTitleProps) {
  return (
    <h2 className={cn("flex items-center gap-2 text-base font-bold uppercase tracking-widest", className)}>
      <span aria-hidden className="inline-block h-3.5 w-1 bg-accent" />
      {children}
    </h2>
  );
}
