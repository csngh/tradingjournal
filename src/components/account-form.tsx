"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/form";
import { createAccount, updateAccount, type AccountInput } from "@/app/actions";
import type { Account } from "@/db/schema";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#ec4899", "#84cc16"];

export function AccountForm({
  open,
  onClose,
  account,
  potentialMasters,
  tradesNet = 0,
}: {
  open: boolean;
  onClose: () => void;
  account?: Account | null;
  potentialMasters: Account[];
  tradesNet?: number;
}) {
  const [name, setName] = useState(account?.name ?? "");
  const [broker, setBroker] = useState(account?.broker ?? "");
  const [color, setColor] = useState(account?.color ?? COLORS[0]);
  const [role, setRole] = useState<AccountInput["role"]>(account?.role ?? "STANDALONE");
  const [accountType, setAccountType] = useState<"" | "CHALLENGE" | "FUNDED">(
    account?.accountType ?? ""
  );
  const [masterId, setMasterId] = useState(account?.masterId ?? potentialMasters[0]?.id ?? "");
  const [copyRatio, setCopyRatio] = useState(String(account?.copyRatio ?? 1));
  const [startingBalance, setStartingBalance] = useState(
    String(account?.startingBalance ?? 50000)
  );
  const [currentBalance, setCurrentBalance] = useState(
    String((account?.startingBalance ?? 50000) + tradesNet + (account?.balanceAdjustment ?? 0))
  );
  const [highestBalance, setHighestBalance] = useState(
    account?.highestBalance != null ? String(account.highestBalance) : ""
  );
  const [feePerContract, setFeePerContract] = useState(
    account?.feePerContract != null ? String(account.feePerContract) : ""
  );
  const [trailingDrawdown, setTrailingDrawdown] = useState(
    account?.trailingDrawdown != null ? String(account.trailingDrawdown) : ""
  );
  const [drawdownLockEnabled, setDrawdownLockEnabled] = useState(
    account?.drawdownLockEnabled ?? true
  );
  const [drawdownStopsAt, setDrawdownStopsAt] = useState(
    account?.drawdownStopsAt != null ? String(account.drawdownStopsAt) : ""
  );
  const [targetProfit, setTargetProfit] = useState(
    account?.targetProfit != null ? String(account.targetProfit) : ""
  );
  const [status, setStatus] = useState<AccountInput["status"]>(account?.status ?? "ACTIVE");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const startingBalanceNum = Number(startingBalance) || 0;
    const currentBalanceNum = currentBalance ? Number(currentBalance) : startingBalanceNum + tradesNet;
    const balanceAdjustment = currentBalanceNum - startingBalanceNum - tradesNet;
    const input: AccountInput = {
      name,
      broker: broker || null,
      color,
      role,
      masterId: role === "FOLLOWER" ? masterId : null,
      copyRatio: role === "FOLLOWER" ? Number(copyRatio) || 1 : 1,
      accountType: accountType || null,
      startingBalance: startingBalanceNum,
      balanceAdjustment,
      highestBalance: highestBalance ? Number(highestBalance) : null,
      feePerContract: feePerContract ? Number(feePerContract) : null,
      trailingDrawdown: trailingDrawdown ? Number(trailingDrawdown) : null,
      drawdownLockEnabled,
      drawdownStopsAt: drawdownStopsAt ? Number(drawdownStopsAt) : null,
      targetProfit: targetProfit ? Number(targetProfit) : null,
      status,
    };
    try {
      if (account) {
        await updateAccount(account.id, input);
      } else {
        await createAccount(input);
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={account ? "Edit account" : "Add account"} icon={Wallet}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Account name</label>
            <input
              required
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Apex 150K #1"
            />
          </div>
          <div>
            <label className={labelClass}>Broker / firm</label>
            <input
              className={inputClass}
              value={broker ?? ""}
              onChange={(e) => setBroker(e.target.value)}
              placeholder="e.g. Apex, Tradovate"
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Color tag</label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="h-7 w-7 rounded-full ring-offset-2"
                style={{
                  background: c,
                  boxShadow: color === c ? `0 0 0 2px var(--bg-elevated), 0 0 0 4px ${c}` : "none",
                }}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Role</label>
            <select
              className={inputClass}
              value={role}
              onChange={(e) => setRole(e.target.value as AccountInput["role"])}
            >
              <option value="STANDALONE">Standalone</option>
              <option value="MASTER">Master (copies to followers)</option>
              <option value="FOLLOWER">Follower (copies a master)</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Account type</label>
            <select
              className={inputClass}
              value={accountType}
              onChange={(e) => setAccountType(e.target.value as "" | "CHALLENGE" | "FUNDED")}
            >
              <option value="">Not set</option>
              <option value="CHALLENGE">Challenge</option>
              <option value="FUNDED">Funded</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select
              className={inputClass}
              value={status}
              onChange={(e) => setStatus(e.target.value as AccountInput["status"])}
            >
              <option value="ACTIVE">Active</option>
              <option value="PASSED">Passed</option>
              <option value="BLOWN">Blown</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
        </div>

        {role === "FOLLOWER" && (
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-[var(--surface-2)] p-3">
            <div>
              <label className={labelClass}>Copies from</label>
              <select
                className={inputClass}
                value={masterId}
                onChange={(e) => setMasterId(e.target.value)}
              >
                {potentialMasters.length === 0 && <option value="">No master accounts yet</option>}
                {potentialMasters.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Size ratio (vs. master)</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                className={inputClass}
                value={copyRatio}
                onChange={(e) => setCopyRatio(e.target.value)}
                placeholder="1 = same size"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Starting balance</label>
            <input
              required
              type="number"
              step="0.01"
              className={inputClass}
              value={startingBalance}
              onChange={(e) => setStartingBalance(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Current balance</label>
            <input
              type="number"
              step="0.01"
              className={inputClass}
              value={currentBalance}
              onChange={(e) => setCurrentBalance(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              Adding an account mid-journey? Set what it&apos;s worth right now, no need to
              log every past trade.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Fee per contract ($)</label>
            <input
              type="number"
              step="0.01"
              className={inputClass}
              value={feePerContract}
              onChange={(e) => setFeePerContract(e.target.value)}
              placeholder="Round-trip commission, e.g. 4.50"
            />
          </div>
          <div>
            <label className={labelClass}>Highest balance reached</label>
            <input
              type="number"
              step="0.01"
              className={inputClass}
              value={highestBalance}
              onChange={(e) => setHighestBalance(e.target.value)}
              placeholder="Defaults to current balance"
            />
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              Seeds the trailing-drawdown peak; it keeps rising automatically as you set new highs.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Trailing drawdown ($)</label>
            <input
              type="number"
              step="0.01"
              className={inputClass}
              value={trailingDrawdown}
              onChange={(e) => setTrailingDrawdown(e.target.value)}
              placeholder="Optional, e.g. 2000"
            />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text)]">
              <input
                type="checkbox"
                className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
                checked={drawdownLockEnabled}
                onChange={(e) => setDrawdownLockEnabled(e.target.checked)}
              />
              Lock drawdown floor
            </label>
          </div>
        </div>

        {drawdownLockEnabled && (
          <div>
            <label className={labelClass}>Drawdown locks at ($)</label>
            <input
              type="number"
              step="0.01"
              className={inputClass}
              value={drawdownStopsAt}
              onChange={(e) => setDrawdownStopsAt(e.target.value)}
              placeholder={`Defaults to starting balance`}
            />
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              Uncheck the lock floor above if this account&apos;s trailing drawdown has no lock and
              keeps rising with every new high instead.
            </p>
          </div>
        )}

        <div>
          <label className={labelClass}>Profit target ($)</label>
          <input
            type="number"
            step="0.01"
            className={inputClass}
            value={targetProfit}
            onChange={(e) => setTargetProfit(e.target.value)}
            placeholder="Optional, e.g. 3000"
          />
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Cancel
          </button>
          <button type="submit" disabled={submitting} className={primaryButtonClass}>
            {submitting ? "Saving…" : account ? "Save changes" : "Add account"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
