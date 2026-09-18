import { UnlockForm } from "@/components/unlock-form";

export const dynamic = "force-dynamic";

export default function UnlockPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bg)] p-4">
      {/* Decorative blurred backdrop only — no real data ever reaches this page, so there's
          nothing sensitive to hide behind the blur. It's purely a visual cue. */}
      <div className="pointer-events-none absolute inset-0 opacity-60 blur-2xl" aria-hidden>
        <div className="absolute left-[8%] top-[12%] h-32 w-64 rounded-2xl border border-[var(--border)] bg-[var(--surface)]" />
        <div className="absolute right-[10%] top-[18%] h-40 w-52 rounded-2xl border border-[var(--border)] bg-[var(--surface)]" />
        <div className="absolute bottom-[15%] left-[15%] h-48 w-72 rounded-2xl [background-image:var(--gradient-profit-soft)]" />
        <div className="absolute bottom-[10%] right-[12%] h-36 w-60 rounded-2xl [background-image:var(--gradient-accent-soft)]" />
      </div>

      <UnlockForm />
    </div>
  );
}
