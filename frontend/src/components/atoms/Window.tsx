import type { ReactNode } from "react";
import TitleBar from "./TitleBar";

interface WindowProps {
  title: string;
  active?: boolean;
  className?: string;
  children: ReactNode;
}

export default function Window({ title, active = true, className = "", children }: WindowProps) {
  return (
    <div className={`window ${className}`.trim()}>
      <TitleBar title={title} active={active} />
      <div className="window-body">{children}</div>
    </div>
  );
}
