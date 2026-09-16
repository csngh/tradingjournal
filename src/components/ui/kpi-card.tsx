import type { ReactNode } from "react";

type Tone = "neutral" | "profit" | "loss" | "accent";

const toneClasses: Record<Tone, string> = {
  neutral: "text-[var(--text)]",
  profit: "text-[var(--profit)]",
  loss: "text-[var(--loss)]",
  accent: "text-[var(--accent)]",
};

export function KpiCard({
  label,
  value,
  sub,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-[var(--text-muted)]">
          {label}
        </span>
        {icon && <span className="text-[var(--text-faint)]">{icon}</span>}
      </div>
      <div className={`mt-2 text-2xl font-semibold tabular tracking-tight ${toneClasses[tone]}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-[var(--text-muted)]">{sub}</div>}
    </div>
  );
}
