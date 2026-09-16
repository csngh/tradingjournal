export function Progress({
  pct,
  tone = "accent",
}: {
  pct: number;
  tone?: "accent" | "profit" | "loss" | "warning";
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const color = {
    accent: "var(--accent)",
    profit: "var(--profit)",
    loss: "var(--loss)",
    warning: "var(--warning)",
  }[tone];

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${clamped}%`, background: color }}
      />
    </div>
  );
}
