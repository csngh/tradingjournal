"use client";

import { useState } from "react";
import Image from "next/image";
import { Lock } from "lucide-react";
import { unlock } from "@/app/unlock/actions";
import { inputClass, primaryButtonClass } from "@/components/ui/form";

export function UnlockForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(false);
    const result = await unlock(password);
    // A correct password redirects server-side inside unlock(), so this only runs on failure.
    if (!result.ok) {
      setError(true);
      setSubmitting(false);
      setPassword("");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative z-10 flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-8 shadow-2xl"
    >
      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-black">
        <Image
          src="/logo.png"
          alt="Gringotts Trading Journal"
          width={56}
          height={56}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="text-center">
        <h1 className="text-lg font-semibold text-[var(--text)]">Gringotts Trading Journal</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Enter the password to unlock.</p>
      </div>

      <div className="flex w-full items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3">
        <Lock size={15} className="shrink-0 text-[var(--text-faint)]" />
        <input
          type="password"
          autoFocus
          required
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(false);
          }}
          placeholder="Password"
          className={`${inputClass} border-0 bg-transparent px-0 focus:border-0`}
        />
      </div>

      {error && (
        <p className="w-full text-left text-xs font-medium text-[var(--loss)]">
          Incorrect password. Try again.
        </p>
      )}

      <button type="submit" disabled={submitting || !password} className={`${primaryButtonClass} w-full`}>
        {submitting ? "Unlocking…" : "Unlock"}
      </button>
    </form>
  );
}
