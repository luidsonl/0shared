import { cn } from "../../lib/utils";

interface ErrorTextProps {
  message: string;
  className?: string;
}

export default function ErrorText({ message, className = "" }: ErrorTextProps) {
  return <p className={cn("text-xs font-medium text-danger", className)}>ERROR: {message}</p>;
}
