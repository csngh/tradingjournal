"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/form";
import { importBacktestTrades } from "@/app/actions";
import { BACKTEST_CSV_TEMPLATE, parseBacktestCsv, type ParsedBacktestRow } from "@/lib/backtest-csv";
import { downloadCsv } from "@/lib/csv";
import type { Strategy } from "@/db/schema";

export function BacktestImport({
  open,
  onClose,
  strategy,
  timeZone,
}: {
  open: boolean;
  onClose: () => void;
  strategy: Strategy;
  timeZone: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedBacktestRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    const result = parseBacktestCsv(text, strategy, timeZone);
    setRows(result.rows);
    setErrors(result.errors);
  }

  async function handleImport() {
    setSubmitting(true);
    try {
      await importBacktestTrades(strategy.id, rows);
      onClose();
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "The import failed."]);
    } finally {
      setSubmitting(false);
    }
  }

  const blocked = errors.length > 0;

  return (
    <Modal open={open} onClose={onClose} title="Import trades from CSV" icon={Upload} width="max-w-lg">
      <div className="flex flex-col gap-4 text-sm">
        <p className="text-[var(--text-muted)]">
          Needs a <b className="text-[var(--text)]">Date</b>, <b className="text-[var(--text)]">Side</b> and{" "}
          <b className="text-[var(--text)]">Points</b> column (or an <b className="text-[var(--text)]">Exit</b> of TP
          or SL, which is converted using this strategy&apos;s TP and SL; BE means breakeven, zero points but fees still apply). Optional: Time, Contracts, Fees, Notes.
          Times are read in {timeZone}; rows without a time are kept date-only. Missing contracts and fees use the
          strategy defaults.
        </p>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} className={secondaryButtonClass}>
            <Upload size={15} />
            Choose CSV file
          </button>
          <button
            type="button"
            onClick={() => downloadCsv("backtest-template.csv", BACKTEST_CSV_TEMPLATE)}
            className={secondaryButtonClass}
          >
            Download template
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>

        {fileName && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-3">
            <p className="font-medium text-[var(--text)]">{fileName}</p>
            {blocked ? (
              <>
                <p className="mt-1 text-[var(--loss)]">
                  Nothing was imported. Fix these {errors.length} problem{errors.length === 1 ? "" : "s"} and choose
                  the file again:
                </p>
                <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5 text-xs text-[var(--text-muted)]">
                  {errors.slice(0, 50).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                  {errors.length > 50 && <li>…and {errors.length - 50} more.</li>}
                </ul>
              </>
            ) : (
              <p className="mt-1 text-[var(--profit)]">
                {rows.length} trade{rows.length === 1 ? "" : "s"} ready to import.
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting || blocked || rows.length === 0}
            onClick={handleImport}
            className={primaryButtonClass}
          >
            {submitting ? "Importing…" : `Import ${rows.length || ""} trades`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
