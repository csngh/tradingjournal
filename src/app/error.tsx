"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-20 text-center">
      <AlertTriangle size={28} className="text-[var(--loss)]" />
      <h2 className="mt-3 text-lg font-semibold text-[var(--text)]">Something went wrong</h2>
      <p className="mt-2 max-w-sm text-sm text-[var(--text-muted)]">
        {error.message || "An unexpected error occurred while rendering this page."}
      </p>
      <button
        onClick={reset}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 cursor-pointer"
      >
        Try again
      </button>
    </div>
  );
}
