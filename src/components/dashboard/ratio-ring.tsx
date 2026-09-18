const SIZE = 58;
const R = 22;
const STROKE = 7;
const CIRC = 2 * Math.PI * R;
/** Visual gap between segments. */
const GAP = 8;

/** Two-segment ring showing how gross profit and gross loss split the total traded flow. */
export function RatioRing({ won, lost }: { won: number; lost: number }) {
  const total = won + lost;
  const wonShare = total > 0 ? won / total : 0;

  const wonLen = Math.max(0, wonShare * CIRC - (wonShare > 0 && wonShare < 1 ? GAP : 0));
  const lostLen = Math.max(0, (1 - wonShare) * CIRC - (wonShare > 0 && wonShare < 1 ? GAP : 0));

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="presentation">
      <defs>
        <linearGradient id="ratioWonGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--profit)" />
          <stop offset="100%" stopColor="var(--profit-2)" />
        </linearGradient>
        <linearGradient id="ratioLostGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--loss)" />
          <stop offset="100%" stopColor="var(--loss-2)" />
        </linearGradient>
      </defs>
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
              stroke="url(#ratioWonGrad)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDashoffset={-GAP / 2}
              className="animate-ring-grow"
              style={{ strokeDasharray: `${wonLen} ${CIRC - wonLen}` }}
            />
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke="url(#ratioLostGrad)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDashoffset={-(wonShare * CIRC + GAP / 2)}
              className="animate-ring-grow"
              style={{ strokeDasharray: `${lostLen} ${CIRC - lostLen}` }}
            />
          </>
        )}
      </g>
    </svg>
  );
}
