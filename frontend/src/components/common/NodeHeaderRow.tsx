import type { ReactNode } from "react";

interface NodeHeaderRowProps {
  left: ReactNode;
  right?: ReactNode;
  className?: string;
}

export default function NodeHeaderRow({ left, right, className }: NodeHeaderRowProps) {
  return (
    <div className={`mb-2 flex items-center justify-between ${className ?? ""}`.trim()}>
      <div className="flex min-w-0 items-center gap-2">{left}</div>
      {right ? <div className="shrink-0 flex items-center gap-2">{right}</div> : null}
    </div>
  );
}
