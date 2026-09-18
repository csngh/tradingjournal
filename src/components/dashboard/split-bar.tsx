/** Horizontal part-to-whole bar with a 2px surface gap between the two fills. */
export function SplitBar({ left, right }: { left: number; right: number }) {
  const total = left + right;
  const leftShare = total > 0 ? (left / total) * 100 : 50;

  return (
    <div className="flex h-2 w-full items-stretch gap-[2px] overflow-hidden">
      <div
        className="animate-bar-grow rounded-full"
        style={{ width: `${leftShare}%`, background: "var(--gradient-profit)" }}
      />
      <div className="flex-1 rounded-full" style={{ background: "var(--gradient-loss)" }} />
    </div>
  );
}
