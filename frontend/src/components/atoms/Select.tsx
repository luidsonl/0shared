import type { ReactNode } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

interface SelectTriggerProps {
  className?: string;
  children: ReactNode;
}

function SelectTrigger({ className = "", children }: SelectTriggerProps) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        "inline-flex h-9 items-center justify-between gap-3 border border-border bg-surface px-3 text-sm text-foreground",
        "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent",
        "data-[placeholder]:text-muted",
        className,
      )}
    >
      {children}
      <SelectPrimitive.Icon className="text-muted">
        <ChevronDown size={14} />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

interface SelectContentProps {
  children: ReactNode;
}

function SelectContent({ children }: SelectContentProps) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position="popper"
        sideOffset={4}
        className={cn(
          "z-50 min-w-[var(--radix-select-trigger-width)] border border-border bg-background p-1",
          "shadow-[0_12px_24px_rgba(0,0,0,0.5)]",
        )}
      >
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

interface SelectItemProps {
  value: string;
  className?: string;
  children: ReactNode;
}

function SelectItem({ value, className = "", children }: SelectItemProps) {
  return (
    <SelectPrimitive.Item
      value={value}
      className={cn(
        "flex cursor-pointer items-center justify-between gap-4 px-2.5 py-1.5 text-sm text-foreground",
        "focus:bg-surface-elevated focus:outline-none",
        "data-[state=checked]:text-accent",
        className,
      )}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator>
        <Check size={14} />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export default Select;
export { SelectTrigger, SelectContent, SelectItem };
