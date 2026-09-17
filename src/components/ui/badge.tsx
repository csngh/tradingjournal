import type { ReactNode } from "react";

type Tone = "neutral" | "profit" | "loss" | "accent" | "warning";

const toneTextClasses: Record<Tone, string> = {
  neutral: "text-[var(--text-muted)]",
  profit: "text-[var(--profit)]",
  loss: "text-[var(--loss)]",
  accent: "text-[var(--accent)]",
  warning: "text-[var(--warning)]",
};

const toneBackgrounds: Record<Tone, string> = {
  neutral: "var(--surface-2)",
  profit: "var(--gradient-profit-soft)",
  loss: "var(--gradient-loss-soft)",
  accent: "var(--gradient-accent-soft)",
  warning: "var(--surface-2)",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${toneTextClasses[tone]}`}
      style={{ background: toneBackgrounds[tone] }}
    >
      {children}
    </span>
  );
}
