"use client";

import { useState } from "react";
import {
  Pencil,
  Trash2,
  PlusCircle,
  Link2,
  Wallet,
  Crown,
  CheckCircle2,
  XCircle,
  Archive,
  ShieldAlert,
  Target,
  GraduationCap,
  BadgeCheck,
} from "lucide-react";
import { AccountForm } from "@/components/account-form";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { primaryButtonClass } from "@/components/ui/form";
import { deleteAccount } from "@/app/actions";
import { formatCurrency } from "@/lib/metrics";
import type { Account } from "@/db/schema";

export type AccountWithMetrics = {
  account: Account;
  balance: number;
  drawdown: ReturnType<typeof import("@/lib/metrics").computeTrailingDrawdown>;
  target: ReturnType<typeof import("@/lib/metrics").computeTargetProgress>;
  tradeCount: number;
  tradesNet: number;
};

export function AccountsClient({ items }: { items: AccountWithMetrics[] }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const allAccounts = items.map((i) => i.account);
  const masters = allAccounts.filter((a) => a.role === "MASTER");

  function openAdd() {
    setEditing(null);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  }

  function openEdit(account: Account) {
    setEditing(account);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteAccount(id);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-[var(--text)]">
          <Wallet size={20} className="text-[var(--accent)]" />
          Accounts
        </h1>
        <button onClick={openAdd} className={primaryButtonClass}>
          <PlusCircle size={16} />
          Add account
        </button>
      </div>

      {items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-16 text-center text-sm text-[var(--text-muted)]">
          No accounts yet. Add your first prop firm or broker account to get started.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map(({ account: a, balance, drawdown, target, tradeCount }) => {
          const master = a.masterId ? allAccounts.find((m) => m.id === a.masterId) : null;
          const followers = allAccounts.filter((f) => f.masterId === a.id);

          return (
            <div key={a.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: a.color }} />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-[var(--text)]">{a.name}</h3>
                      {a.role === "MASTER" && (
                        <Badge tone="accent">
                          <Crown size={10} className="mr-0.5" />
                          MASTER
                        </Badge>
                      )}
                      {a.role === "FOLLOWER" && (
                        <Badge>
                          <Link2 size={10} className="mr-0.5" />
                          COPY
                        </Badge>
                      )}
                      {a.accountType === "CHALLENGE" && (
                        <Badge tone="warning">
                          <GraduationCap size={10} className="mr-0.5" />
                          CHALLENGE
                        </Badge>
                      )}
                      {a.accountType === "FUNDED" && (
                        <Badge tone="profit">
                          <BadgeCheck size={10} className="mr-0.5" />
                          FUNDED
                        </Badge>
                      )}
                      {a.status !== "ACTIVE" && (
                        <Badge tone={a.status === "PASSED" ? "profit" : a.status === "BLOWN" ? "loss" : "neutral"}>
                          {a.status === "PASSED" && <CheckCircle2 size={10} className="mr-0.5" />}
                          {a.status === "BLOWN" && <XCircle size={10} className="mr-0.5" />}
                          {a.status === "CLOSED" && <Archive size={10} className="mr-0.5" />}
                          {a.status}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">{a.broker || "No broker set"}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(a)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-2)] cursor-pointer"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(a.id)}
                    disabled={deletingId === a.id}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-muted)] hover:[background-image:var(--gradient-loss-soft)] hover:text-[var(--loss)] cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="mt-4 text-2xl font-semibold tabular text-[var(--text)]">
                {formatCurrency(balance)}
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                {tradeCount} trade{tradeCount === 1 ? "" : "s"} · started {formatCurrency(a.startingBalance)}
                {a.feePerContract != null && ` · ${formatCurrency(a.feePerContract)}/contract`}
              </p>

              {master && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                  <Link2 size={12} />
                  Copies {master.name} at {a.copyRatio}x size
                </div>
              )}
              {followers.length > 0 && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                  <Link2 size={12} />
                  Mirrors to {followers.map((f) => f.name).join(", ")}
                </div>
              )}

              {drawdown.enabled && (
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-[11px] text-[var(--text-muted)]">
                    <span className="flex items-center gap-1">
                      <ShieldAlert size={11} />
                      Drawdown cushion
                    </span>
                    <span>{formatCurrency(Math.max(0, drawdown.distanceToBreach))}</span>
                  </div>
                  <Progress
                    pct={a.trailingDrawdown ? (drawdown.distanceToBreach / a.trailingDrawdown) * 100 : 100}
                    tone={drawdown.breached ? "loss" : "profit"}
                  />
                </div>
              )}

              {target.enabled && (
                <div className="mt-2">
                  <div className="mb-1 flex justify-between text-[11px] text-[var(--text-muted)]">
                    <span className="flex items-center gap-1">
                      <Target size={11} />
                      Target progress
                    </span>
                    <span>{target.progressPct.toFixed(2)}%</span>
                  </div>
                  <Progress pct={target.progressPct} tone={target.reached ? "profit" : "accent"} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <AccountForm
        key={formKey}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        account={editing}
        potentialMasters={masters.filter((m) => m.id !== editing?.id)}
        tradesNet={items.find((i) => i.account.id === editing?.id)?.tradesNet ?? 0}
      />
    </div>
  );
}
