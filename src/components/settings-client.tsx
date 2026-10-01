"use client";

import { useMemo, useState } from "react";
import { Check, Clock, Globe, Scale } from "lucide-react";
import { updateTimezone, updateCountBreakeven } from "@/app/actions";
import { inputClass, labelClass, primaryButtonClass } from "@/components/ui/form";
import { TagsManager } from "@/components/tags-manager";
import { DataManager } from "@/components/data-manager";
import { DangerZone } from "@/components/danger-zone";
import type { TimezoneOption } from "@/lib/timezone";
import type { Tag } from "@/db/schema";
import { BACKTEST_ENABLED } from "@/lib/features";

export function SettingsClient({
  currentTimezone,
  timezones,
  currentCountBreakeven,
  tags,
}: {
  currentTimezone: string;
  timezones: TimezoneOption[];
  currentCountBreakeven: boolean;
  tags: Tag[];
}) {
  const [timezone, setTimezone] = useState(currentTimezone);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [countBreakeven, setCountBreakeven] = useState(currentCountBreakeven);
  const [savingBe, setSavingBe] = useState(false);

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

  async function handleCountBreakevenChange(next: boolean) {
    setCountBreakeven(next);
    setSavingBe(true);
    try {
      await updateCountBreakeven(next);
    } finally {
      setSavingBe(false);
    }
  }

  return (
    <div className="grid max-w-6xl grid-cols-1 gap-2.5 lg:grid-cols-2">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="flex items-center gap-2 text-[17px] font-semibold text-[var(--text)]">
          <Globe size={17} className="text-[var(--accent)]" />
          Timezone
        </h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Controls which calendar day trades are grouped under and every date shown across the
          journal, independent of this browser or computer&apos;s own timezone.
        </p>

        <div className="mt-3">
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

        <div className="mt-3 flex items-center gap-3">
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

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="flex items-center gap-2 text-[17px] font-semibold text-[var(--text)]">
          <Scale size={17} className="text-[var(--accent)]" />
          Breakeven trades
        </h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Controls whether breakeven trades count toward trade-quality metrics like win rate and
          profit factor, on the dashboard and the Trades page{BACKTEST_ENABLED ? " and Backtest strategies" : ""}.
          Net P&amp;L and account balance always reflect the real dollar result regardless of this setting.
        </p>

        <div className="mt-3 flex gap-1 rounded-xl bg-[var(--surface-2)] p-1">
          <button
            type="button"
            onClick={() => handleCountBreakevenChange(true)}
            disabled={savingBe}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition cursor-pointer ${
              countBreakeven
                ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            Count breakeven trades
          </button>
          <button
            type="button"
            onClick={() => handleCountBreakevenChange(false)}
            disabled={savingBe}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition cursor-pointer ${
              !countBreakeven
                ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            Exclude breakeven trades
          </button>
        </div>
        <p className="mt-2 text-[11px] text-[var(--text-muted)]">
          {countBreakeven
            ? "Breakeven trades are included as scratches. They count toward total trades but not wins or losses."
            : "Breakeven trades are left out of dashboard metrics entirely, as if they were never logged."}
        </p>
      </div>

      <TagsManager tags={tags} />
      <DataManager />

      <div className="lg:col-span-2">
        <DangerZone />
      </div>
    </div>
  );
}
