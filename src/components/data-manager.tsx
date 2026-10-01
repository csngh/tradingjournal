"use client";

import { useRef, useState } from "react";
import { Database, Download, Upload, AlertTriangle } from "lucide-react";
import { exportAllData, importAllData } from "@/app/actions";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/form";
import { BACKTEST_ENABLED } from "@/lib/features";

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const MAX_ERRORS_SHOWN = 15;

export function DataManager() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState<string[] | null>(null);

  async function handleExport() {
    setExporting(true);
    setErrors(null);
    try {
      const data = await exportAllData();
      const stamp = new Date().toISOString().slice(0, 10);
      downloadJson(`gringotts-backup-${stamp}.json`, data);
    } finally {
      setExporting(false);
    }
  }

  function handleImportClick() {
    setErrors(null);
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const confirmed = window.confirm(
      `Importing replaces every account, trade, tag, ${BACKTEST_ENABLED ? "backtest strategy, " : ""}and saved setting currently on this device ` +
        "with the contents of this file. This can't be undone. Continue?"
    );
    if (!confirmed) return;

    setImporting(true);
    setErrors(null);
    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        setErrors(["That file isn't valid JSON."]);
        return;
      }
      const result = await importAllData(parsed);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      window.location.reload();
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="flex items-center gap-2 text-[17px] font-semibold text-[var(--text)]">
        <Database size={17} className="text-[var(--accent)]" />
        Backup &amp; transfer
      </h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Export every account, trade, tag, {BACKTEST_ENABLED ? "backtest strategy, " : ""}and saved setting as a single JSON file. Import that
        file on another device to move your whole journal over.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={handleExport} disabled={exporting} className={primaryButtonClass}>
          <Download size={16} />
          {exporting ? "Exporting…" : "Export all data"}
        </button>
        <button onClick={handleImportClick} disabled={importing} className={secondaryButtonClass}>
          <Upload size={16} />
          {importing ? "Importing…" : "Import from file"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={handleFileSelected}
        />
      </div>

      {errors && errors.length > 0 && (
        <div className="mt-3 rounded-xl bg-[var(--gradient-loss-soft)] px-3 py-2.5 text-sm text-[var(--loss)]">
          <p className="flex items-start gap-1.5 font-medium">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            {errors.length === 1 ? "This file can't be imported:" : `This file can't be imported (${errors.length} problems found):`}
          </p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-6">
            {errors.slice(0, MAX_ERRORS_SHOWN).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
            {errors.length > MAX_ERRORS_SHOWN && (
              <li>…and {errors.length - MAX_ERRORS_SHOWN} more.</li>
            )}
          </ul>
        </div>
      )}

      <p className="mt-3 text-[11px] text-[var(--text-muted)]">
        Importing replaces everything currently stored on this device. Export a fresh backup
        first if you want to keep what&apos;s here.
      </p>
    </div>
  );
}
