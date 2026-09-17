import { Info } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { Tooltip } from "@/components/ui/tooltip";

export function StatCard({
  label,
  hint,
  icon: Icon,
  badges,
  children,
  className = "",
}: {
  label: string;
  hint: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  badges?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[15px] font-medium text-[var(--text-muted)]">
          {Icon && <Icon size={14} className="text-[var(--accent)]" />}
          {label}
          <Tooltip content={hint}>
            <span className="flex cursor-help items-center text-[var(--text-faint)]">
              <Info size={14} />
            </span>
          </Tooltip>
        </span>
        {badges}
      </div>
      <div className="flex flex-1 flex-col justify-center">{children}</div>
    </div>
  );
}

export function StreakBadges({ wins, losses }: { wins: number; losses: number }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      <span
        className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-[var(--profit)]"
        style={{ background: "var(--gradient-profit-soft)" }}
        title={`Best run: ${wins} in a row`}
      >
        {wins} W
      </span>
      <span
        className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-[var(--loss)]"
        style={{ background: "var(--gradient-loss-soft)" }}
        title={`Worst run: ${losses} in a row`}
      >
        {losses} L
      </span>
    </span>
  );
}
