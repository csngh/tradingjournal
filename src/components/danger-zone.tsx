"use client";

import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { resetAllData } from "@/app/actions";
import { inputClass, secondaryButtonClass } from "@/components/ui/form";
import { BACKTEST_ENABLED } from "@/lib/features";

const CONFIRM_WORD = "DELETE";

const dangerSolidButtonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-xl [background-image:var(--gradient-loss)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

function clearClientStorage() {
  try {
    localStorage.clear();
  } catch {
    // Private browsing or blocked storage, nothing more we can do client-side.
  }
  try {
    sessionStorage.clear();
  } catch {
    // Same as above.
  }
  if (typeof indexedDB !== "undefined" && indexedDB.databases) {
    indexedDB
      .databases()
      .then((dbs) => dbs.forEach((db) => db.name && indexedDB.deleteDatabase(db.name)))
      .catch(() => {});
  }
}

export function DangerZone() {
  const [expanded, setExpanded] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleConfirmedDelete() {
    setDeleting(true);
    try {
      await resetAllData();
      clearClientStorage();
      // A hard reload, not router.push: after wiping everything, nothing client-side (React state,
      // Next's router cache, in-memory query results) should survive into the next render.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/";
    } catch {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--loss)]/40 bg-[var(--surface)] p-4">
      <h2 className="flex items-center gap-2 text-[17px] font-semibold text-[var(--loss)]">
        <AlertTriangle size={17} />
        Danger zone
      </h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Permanently deletes every account, trade, tag, {BACKTEST_ENABLED ? "backtest strategy, " : ""}and saved setting from this device, and
        clears this app&apos;s local browser storage. There is no undo and no backup is made.
        Export a backup first if you want to keep anything.
      </p>

      {!expanded ? (
        <button onClick={() => setExpanded(true)} className={`${secondaryButtonClass} mt-3`}>
          <Trash2 size={16} />
          Delete all data
        </button>
      ) : (
        <div className="mt-3 flex flex-col gap-3 rounded-xl border border-[var(--loss)]/40 bg-[var(--gradient-loss-soft)] p-3">
          <p className="text-sm font-medium text-[var(--text)]">
            Type <span className="font-mono font-bold text-[var(--loss)]">{CONFIRM_WORD}</span> to
            confirm. This deletes everything and restarts the app fresh.
          </p>
          <input
            className={inputClass}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_WORD}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                setExpanded(false);
                setConfirmText("");
              }}
              className={secondaryButtonClass}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmedDelete}
              disabled={confirmText !== CONFIRM_WORD || deleting}
              className={dangerSolidButtonClass}
            >
              <Trash2 size={16} />
              {deleting ? "Deleting…" : "Permanently delete everything"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
