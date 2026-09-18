import type { Tag } from "@/db/schema";

export function TagPill({ tag }: { tag: Tag }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: `${tag.color}26`, color: tag.color }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: tag.color }} />
      {tag.name}
    </span>
  );
}
