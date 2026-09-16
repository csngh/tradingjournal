import type { ReactNode } from "react";

type Tone = "neutral" | "profit" | "loss" | "accent" | "warning";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-[var(--surface-2)] text-[var(--text-muted)]",
  profit: "bg-[var(--profit-soft)] text-[var(--profit)]",
  loss: "bg-[var(--loss-soft)] text-[var(--loss)]",
  accent: "bg-[var(--accent-soft)] text-[var(--accent)]",
  warning: "bg-[var(--surface-2)] text-[var(--warning)]",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
