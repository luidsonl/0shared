import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

interface DialogContentProps {
  title: string;
  className?: string;
  children: ReactNode;
}

export function DialogContent({ title, className = "", children }: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/70 backdrop-blur-[1px]" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2",
          "border border-border bg-background shadow-[0_24px_48px_rgba(0,0,0,0.5)]",
          "focus:outline-none",
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <DialogPrimitive.Title className="text-xs font-bold uppercase tracking-widest">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close
            aria-label="Close"
            className="text-muted transition-colors hover:text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <X size={16} />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogBody({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={cn("space-y-4 p-4", className)}>{children}</div>;
}

export function DialogFooter({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex items-center justify-end gap-2 border-t border-border px-4 py-3", className)}>
      {children}
    </div>
  );
}
