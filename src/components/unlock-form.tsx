"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Lock, Fingerprint } from "lucide-react";
import { unlock } from "@/app/unlock/actions";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/form";

export function UnlockForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [touchIDAvailable, setTouchIDAvailable] = useState(false);
  const [touchIDBusy, setTouchIDBusy] = useState(false);
  const [touchIDError, setTouchIDError] = useState<string | null>(null);
  // A ref, not just the touchIDBusy state: two clicks fired close enough together can both read
  // the same not-yet-re-rendered `touchIDBusy` value before React applies the first click's state
  // update, which would let both through despite the button's `disabled` check. A ref is mutated
  // and read synchronously, so it can't race with the render cycle the way state can.
  const touchIDInFlight = useRef(false);

  useEffect(() => {
    window.electronAPI?.touchIDAvailable().then(setTouchIDAvailable).catch(() => setTouchIDAvailable(false));
  }, []);

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

  async function handleTouchID() {
    if (!window.electronAPI || touchIDInFlight.current) return;
    touchIDInFlight.current = true;
    setTouchIDBusy(true);
    setTouchIDError(null);
    try {
      const result = await window.electronAPI.unlockWithTouchID();
      if (result.ok) {
        // A hard navigation, not router.push: this matches how the rest of the app moves on after
        // a privileged server-side state change (e.g. danger-zone.tsx after a reset), and guarantees
        // the next request actually carries the cookie the main process just set, rather than
        // relying on Next's client router cache.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/";
      } else {
        setTouchIDError(result.error ?? "Touch ID didn't succeed.");
      }
    } catch {
      // The IPC call itself failed (e.g. the main process couldn't set the cookie after a
      // successful Touch ID check) — without this, the busy state would just clear with no
      // explanation and the person would have no idea what to do next.
      setTouchIDError("Something went wrong unlocking with Touch ID. Try the password instead.");
    } finally {
      touchIDInFlight.current = false;
      setTouchIDBusy(false);
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
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {touchIDAvailable ? "Use Touch ID or enter the password to unlock." : "Enter the password to unlock."}
        </p>
      </div>

      {touchIDAvailable && (
        <>
          <button
            type="button"
            onClick={handleTouchID}
            disabled={touchIDBusy}
            className={`${secondaryButtonClass} w-full`}
          >
            <Fingerprint size={16} />
            {touchIDBusy ? "Checking Touch ID…" : "Unlock with Touch ID"}
          </button>
          {touchIDError && (
            <p className="-mt-2 w-full text-left text-xs font-medium text-[var(--loss)]">{touchIDError}</p>
          )}
          <div className="flex w-full items-center gap-3 text-[11px] font-medium text-[var(--text-faint)]">
            <span className="h-px flex-1 bg-[var(--border)]" />
            or
            <span className="h-px flex-1 bg-[var(--border)]" />
          </div>
        </>
      )}

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
