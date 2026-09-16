const SIZE = 58;
const R = 22;
const STROKE = 7;
const CIRC = 2 * Math.PI * R;
/** ~2px of surface gap on each side of a segment boundary. */
const GAP = 2;

/**
 * Two-segment ring showing how gross profit and gross loss split the total
 * traded flow. Half the ring is the breakeven mark (profit factor 1.0), shown
 * by the tick at the bottom.
 */
export function RatioRing({ won, lost }: { won: number; lost: number }) {
  const total = won + lost;
  const wonShare = total > 0 ? won / total : 0;

  const wonLen = Math.max(0, wonShare * CIRC - (wonShare > 0 && wonShare < 1 ? GAP : 0));
  const lostLen = Math.max(0, (1 - wonShare) * CIRC - (wonShare > 0 && wonShare < 1 ? GAP : 0));

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="presentation">
      <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={STROKE}
        />
        {total > 0 && (
          <>
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke="var(--profit)"
              strokeWidth={STROKE}
              strokeDasharray={`${wonLen} ${CIRC - wonLen}`}
              strokeDashoffset={-GAP / 2}
            />
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke="var(--loss)"
              strokeWidth={STROKE}
              strokeDasharray={`${lostLen} ${CIRC - lostLen}`}
              strokeDashoffset={-(wonShare * CIRC + GAP / 2)}
            />
          </>
        )}
      </g>
      {/* Breakeven mark: half the ring = profit factor 1.0 */}
      <rect
        x={SIZE / 2 - 1}
        y={SIZE / 2 + R - STROKE / 2 - 1}
        width={2}
        height={STROKE + 2}
        rx={1}
        fill="var(--bg-elevated)"
      />
    </svg>
  );
}
