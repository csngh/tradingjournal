import Link from "next/link";
import { PlusCircle } from "lucide-react";

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-20 text-center">
      <h2 className="text-lg font-semibold text-[var(--text)]">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-[var(--text-muted)]">{description}</p>
      <Link
        href={actionHref}
        className="mt-5 inline-flex items-center gap-2 rounded-xl [background-image:var(--gradient-accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        <PlusCircle size={16} />
        {actionLabel}
      </Link>
    </div>
  );
}
