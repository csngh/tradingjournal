"use client";

import { useMemo, useState } from "react";
import { Check, Clock, Globe } from "lucide-react";
import { updateTimezone } from "@/app/actions";
import { inputClass, labelClass, primaryButtonClass } from "@/components/ui/form";
import type { TimezoneOption } from "@/lib/timezone";

export function SettingsClient({
  currentTimezone,
  timezones,
}: {
  currentTimezone: string;
  timezones: TimezoneOption[];
}) {
  const [timezone, setTimezone] = useState(currentTimezone);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const preview = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date());
    } catch {
      return "—";
    }
  }, [timezone]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await updateTimezone(timezone);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  const dirty = timezone !== currentTimezone;

  return (
    <div className="max-w-xl">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="flex items-center gap-2 text-[17px] font-semibold text-[var(--text)]">
          <Globe size={17} className="text-[var(--accent)]" />
          Timezone
        </h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Controls which calendar day your trades are grouped under, the entry times you type
          into the trade form, and every date shown across the journal — independent of whatever
          timezone this browser or computer happens to be set to.
        </p>

        <div className="mt-4">
          <label className={labelClass}>Timezone</label>
          <select
            className={inputClass}
            value={timezone}
            onChange={(e) => {
              setTimezone(e.target.value);
              setSaved(false);
            }}
          >
            {timezones.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-xl bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-muted)]">
          <Clock size={14} className="shrink-0" />
          Right now it&apos;s <span className="font-medium text-[var(--text)]">{preview}</span> there.
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className={primaryButtonClass}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          {saved && !dirty && (
            <span className="flex items-center gap-1 text-sm font-medium text-[var(--profit)]">
              <Check size={15} />
              Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
