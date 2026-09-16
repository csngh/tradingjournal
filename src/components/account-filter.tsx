"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronDown, Check, Layers } from "lucide-react";
import type { Account } from "@/db/schema";

export function AccountFilter({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const param = searchParams.get("accounts");
  const selected = param ? param.split(",").filter(Boolean) : accounts.map((a) => a.id);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function applySelection(ids: string[]) {
    const params = new URLSearchParams(searchParams.toString());
    if (ids.length === accounts.length || ids.length === 0) {
      params.delete("accounts");
    } else {
      params.set("accounts", ids.join(","));
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function toggle(id: string) {
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : [...selected, id];
    applySelection(next);
  }

  function selectAll() {
    applySelection(accounts.map((a) => a.id));
  }

  const allSelected = selected.length === accounts.length;
  const label = allSelected
    ? "All accounts"
    : selected.length === 1
      ? accounts.find((a) => a.id === selected[0])?.name ?? "1 account"
      : `${selected.length} accounts`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-sm font-medium text-[var(--text)] transition hover:border-[var(--accent)] cursor-pointer"
      >
        <Layers size={14} className="text-[var(--text-muted)]" />
        {label}
        <ChevronDown size={14} className="text-[var(--text-muted)]" />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-64 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-2 shadow-xl">
          <button
            onClick={selectAll}
            className="mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-2)] cursor-pointer"
          >
            All accounts
            {allSelected && <Check size={14} className="text-[var(--accent)]" />}
          </button>
          <div className="my-1 h-px bg-[var(--border)]" />
          <div className="max-h-72 overflow-y-auto">
            {accounts.map((a) => (
              <button
                key={a.id}
                onClick={() => toggle(a.id)}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-2)] cursor-pointer"
              >
                <span className="flex items-center gap-2 truncate">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: a.color }}
                  />
                  <span className="truncate">{a.name}</span>
                  {a.role === "MASTER" && (
                    <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                      MASTER
                    </span>
                  )}
                  {a.role === "FOLLOWER" && (
                    <span className="shrink-0 rounded-full bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
                      COPY
                    </span>
                  )}
                </span>
                {selected.includes(a.id) && (
                  <Check size={14} className="shrink-0 text-[var(--accent)]" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
