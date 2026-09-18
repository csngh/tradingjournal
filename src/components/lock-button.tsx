"use client";

import { Lock } from "lucide-react";
import { lockApp } from "@/app/unlock/actions";

export function LockButton() {
  return (
    <button
      onClick={() => lockApp()}
      title="Lock app"
      className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] transition hover:text-[var(--text)] cursor-pointer"
    >
      <Lock size={15} />
    </button>
  );
}
