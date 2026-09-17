const CX = 90;
const CY = 86;
const R = 72;
const STROKE = 15;
/** Visual gap between segments, expressed in degrees at this radius. */
const GAP_PX = 16;
const GAP_DEG = (GAP_PX / R) * (180 / Math.PI);

function polar(angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + R * Math.cos(rad), y: CY - R * Math.sin(rad) };
}

function arc(startDeg: number, endDeg: number) {
  const s = polar(startDeg);
  const e = polar(endDeg);
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${R} ${R} 0 0 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

type Segment = { share: number; color: string };

export function WinRateGauge({
  wins,
  scratches,
  losses,
  winRate,
}: {
  wins: number;
  scratches: number;
  losses: number;
  winRate: number;
}) {
  const total = wins + scratches + losses;

  const segments: Segment[] = total
    ? (
      [
        { share: wins / total, color: "url(#winRateProfitGrad)" },
        { share: scratches / total, color: "var(--text-faint)" },
        { share: losses / total, color: "url(#winRateLossGrad)" },
      ] as Segment[]
    ).filter((s) => s.share > 0)
    : [];

  // Walk clockwise from 180° (left) to 0° (right).
  let cursor = 180;
  const paths = segments.map((seg, i) => {
    const sweep = seg.share * 180;
    const startGap = i === 0 ? 0 : GAP_DEG / 2;
    const endGap = i === segments.length - 1 ? 0 : GAP_DEG / 2;
    const start = cursor - startGap;
    // Angles decrease clockwise, so the end must never overshoot past the start
    // when a thin segment is narrower than its gaps.
    const end = Math.min(cursor - sweep + endGap, start);
    cursor -= sweep;
    return { d: arc(start, end), color: seg.color };
  });

  return (
    <div className="flex w-full flex-col items-center">
      <svg viewBox="0 0 180 106" className="w-full max-w-[210px]" role="img" aria-label={`Win rate ${winRate.toFixed(2)} percent`}>
        <defs>
          <linearGradient id="winRateProfitGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--profit)" />
            <stop offset="100%" stopColor="var(--profit-2)" />
          </linearGradient>
          <linearGradient id="winRateLossGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--loss)" />
            <stop offset="100%" stopColor="var(--loss-2)" />
          </linearGradient>
        </defs>
        <path d={arc(180, 0)} fill="none" stroke="var(--surface-2)" strokeWidth={STROKE} strokeLinecap="round" />
        {paths.map((p, i) => (
          <path key={i} d={p.d} fill="none" stroke={p.color} strokeWidth={STROKE} strokeLinecap="round" />
        ))}
        <text
          x={CX}
          y={CY - 15}
          textAnchor="middle"
          className="fill-[var(--text)] text-[16px] font-semibold"
        >
          {total ? `${winRate.toFixed(2)}%` : "—"}
        </text>
      </svg>

      <div className="mt-1 flex w-full items-center justify-between px-1">
        <Count value={wins} label="W" color="var(--profit)" background="var(--gradient-profit-soft)" />
        <Count value={scratches} label="BE" color="var(--text-faint)" background="var(--surface-2)" />
        <Count value={losses} label="L" color="var(--loss)" background="var(--gradient-loss-soft)" />
      </div>
    </div>
  );
}

function Count({
  value,
  label,
  color,
  background,
}: {
  value: number;
  label: string;
  color: string;
  background: string;
}) {
  return (
    <span
      className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ color, background }}
      title={`${value} ${label === "W" ? "winning" : label === "L" ? "losing" : "breakeven"} trades`}
    >
      {value}
      <span className="text-[10px] opacity-70">{label}</span>
    </span>
  );
}
