"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Download, Upload } from "lucide-react";
import { exportBacktestData, importBacktestData } from "@/app/actions";
import { secondaryButtonClass } from "@/components/ui/form";

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

/** Export/import just the Backtest section (strategies + their trades) as its own JSON file, separate from the full app backup. */
export function BacktestDataManager({ strategyCount }: { strategyCount: number }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState<string[] | null>(null);

  async function handleExport() {
    setExporting(true);
    setErrors(null);
    try {
      const data = await exportBacktestData();
      const stamp = new Date().toISOString().slice(0, 10);
      downloadJson(`gringotts-backtests-${stamp}.json`, data);
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
      strategyCount > 0
        ? `Importing replaces all ${strategyCount} backtest strateg${strategyCount === 1 ? "y" : "ies"} and their trades with the contents ` +
          "of this file. Your accounts, real trades, tags and settings are not affected. This can't be undone. Continue?"
        : "Importing will add the strategies and trades from this file. Continue?"
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
      const result = await importBacktestData(parsed);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      router.refresh();
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        <button onClick={handleExport} disabled={exporting} className={secondaryButtonClass}>
          <Download size={15} />
          {exporting ? "Exporting…" : "Export backtests"}
        </button>
        <button onClick={handleImportClick} disabled={importing} className={secondaryButtonClass}>
          <Upload size={15} />
          {importing ? "Importing…" : "Import backtests"}
        </button>
        <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleFileSelected} />
      </div>

      {errors && errors.length > 0 && (
        <div className="w-full max-w-md rounded-xl bg-[var(--gradient-loss-soft)] px-3 py-2.5 text-sm text-[var(--loss)]">
          <p className="flex items-start gap-1.5 font-medium">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            {errors.length === 1 ? "This file can't be imported:" : `This file can't be imported (${errors.length} problems found):`}
          </p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-6">
            {errors.slice(0, MAX_ERRORS_SHOWN).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
            {errors.length > MAX_ERRORS_SHOWN && <li>…and {errors.length - MAX_ERRORS_SHOWN} more.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
