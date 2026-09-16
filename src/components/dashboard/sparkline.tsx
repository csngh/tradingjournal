const W = 96;
const H = 38;
const PAD = 3;

/** Compact trend line for a stat tile — no axes, the tile's value is the label. */
export function Sparkline({ values, tone }: { values: number[]; tone: "profit" | "loss" }) {
  if (values.length < 2) {
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="presentation">
        <line
          x1={PAD}
          y1={H / 2}
          x2={W - PAD}
          y2={H / 2}
          stroke="var(--surface-2)"
          strokeWidth={2}
          strokeLinecap="round"
        />
      </svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = (W - PAD * 2) / (values.length - 1);

  const d = values
    .map((v, i) => {
      const x = PAD + i * stepX;
      const y = PAD + (1 - (v - min) / span) * (H - PAD * 2);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  const color = tone === "profit" ? "var(--profit)" : "var(--loss)";

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="presentation">
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
