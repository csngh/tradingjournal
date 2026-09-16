import type { ReactNode } from "react";

export function Tooltip({
  content,
  children,
  className = "",
}: {
  content: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`group relative inline-flex items-center ${className}`}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-[220px] -translate-x-1/2 translate-y-1 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-center text-xs font-medium leading-snug text-[var(--text)] opacity-0 shadow-xl transition duration-150 group-hover:translate-y-0 group-hover:opacity-100"
      >
        {content}
      </span>
    </span>
  );
}
