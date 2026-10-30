"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Upload } from "lucide-react";
import { importStrategiesAsNew } from "@/app/actions";
import { secondaryButtonClass } from "@/components/ui/form";

const MAX_ERRORS_SHOWN = 15;

/** Imports a single strategy (or however many a file holds) as brand-new strategies, alongside whatever already exists. Never deletes or overwrites. */
export function ImportStrategyButton() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState<string[] | null>(null);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

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
      const result = await importStrategiesAsNew(parsed);
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
      <button onClick={() => { setErrors(null); fileInputRef.current?.click(); }} disabled={importing} className={secondaryButtonClass}>
        <Upload size={15} />
        {importing ? "Importing…" : "Import strategy"}
      </button>
      <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleFileSelected} />

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
