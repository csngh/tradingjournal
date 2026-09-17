"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronDown, ChevronLeft, ChevronRight, PlusCircle, TrendingUp, TrendingDown, Minus, X, CalendarDays } from "lucide-react";
import { formatCurrency } from "@/lib/metrics";
import { zonedDayKey } from "@/lib/timezone";
import { Badge } from "@/components/ui/badge";
import { TradeForm } from "@/components/trade-form";
import type { Account, Trade } from "@/db/schema";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function CalendarClient({
  monthParam,
  accounts,
  trades,
  timeZone,
  fillHeight = true,
}: {
  monthParam: string;
  accounts: Account[];
  trades: Trade[];
  timeZone: string;
  /** Fill the available viewport height (standalone page) vs. size to content (dashboard). */
  fillHeight?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const monthDate = parseISO(`${monthParam}-01`);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Trade | null>(null);
  const [formKey, setFormKey] = useState(0);

  const byDay = useMemo(() => {
    const map = new Map<string, Trade[]>();
    for (const t of trades) {
      const key = zonedDayKey(t.exitTime, timeZone);
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return map;
  }, [trades, timeZone]);

  const accountById = new Map(accounts.map((a) => [a.id, a]));

  const gridStart = startOfWeek(startOfMonth(monthDate));
  const gridEnd = endOfWeek(endOfMonth(monthDate));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  function dayPnl(key: string) {
    return (byDay.get(key) ?? []).reduce((s, t) => s + (t.pnl - t.fees), 0);
  }

  function goToMonth(next: Date) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", format(next, "yyyy-MM"));
    router.push(`${pathname}?${params.toString()}`);
  }

  const now = new Date();
  const isCurrentMonth =
    monthDate.getFullYear() === now.getFullYear() && monthDate.getMonth() === now.getMonth();

  const currentRealYear = now.getFullYear();
  const yearOptions = Array.from(
    new Set([
      ...Array.from({ length: 11 }, (_, i) => currentRealYear - 8 + i),
      monthDate.getFullYear(),
    ])
  ).sort((a, b) => a - b);

  function openAddForDay(day: string) {
    setEditing(null);
    setSelectedDay(day);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  }

  function openEdit(trade: Trade) {
    setEditing(trade);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  }

  const selectedTrades = selectedDay ? byDay.get(selectedDay) ?? [] : [];

  const monthTrades = trades.filter((t) => zonedDayKey(t.exitTime, timeZone).startsWith(monthParam));
  const monthPnl = monthTrades.reduce((s, t) => s + (t.pnl - t.fees), 0);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="flex items-center gap-2 text-[17px] font-semibold tracking-tight text-[var(--text)]">
            <CalendarDays size={18} className="text-[var(--accent)]" />
            P&amp;L Calendar
          </h2>
          {monthTrades.length > 0 && (
            <div
              className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular ${
                monthPnl >= 0
                  ? "[background-image:var(--gradient-profit-soft)] text-[var(--profit)]"
                  : "[background-image:var(--gradient-loss-soft)] text-[var(--loss)]"
              }`}
              title="Net P&L for this month"
            >
              {monthPnl >= 0 ? "+" : "-"}
              {formatCurrency(Math.abs(monthPnl))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isCurrentMonth && (
            <button
              onClick={() => goToMonth(new Date(now.getFullYear(), now.getMonth(), 1))}
              className="rounded-full border border-[var(--border)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] cursor-pointer"
            >
              This month
            </button>
          )}
          <button
            onClick={() => goToMonth(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="relative">
            <select
              value={monthDate.getMonth()}
              onChange={(e) =>
                goToMonth(new Date(monthDate.getFullYear(), Number(e.target.value), 1))
              }
              className="appearance-none rounded-full border border-[var(--border)] bg-[var(--surface)] py-1.5 pl-3 pr-7 text-[13px] font-medium text-[var(--text)] cursor-pointer"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i}>
                  {m}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          </div>

          <div className="relative">
            <select
              value={monthDate.getFullYear()}
              onChange={(e) =>
                goToMonth(new Date(Number(e.target.value), monthDate.getMonth(), 1))
              }
              className="appearance-none rounded-full border border-[var(--border)] bg-[var(--surface)] py-1.5 pl-3 pr-7 text-[13px] font-medium text-[var(--text)] cursor-pointer"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          </div>

          <button
            onClick={() => goToMonth(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-2 flex shrink-0 gap-4 md:gap-6">
          <div className="grid flex-1 grid-cols-7 gap-1.5 md:gap-2">
            {WEEKDAYS.map((d) => (
              <div key={d} className="px-1 text-center text-xs font-medium text-[var(--text-muted)]">
                {d}
              </div>
            ))}
          </div>
          <div className="hidden md:block md:shrink-0 md:grow-0 md:basis-[13%] md:border-l md:border-[var(--border)] md:pl-4">
            <div className="px-1 text-center text-xs font-semibold text-[var(--text)]">Weekly</div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 gap-4 md:gap-6">
          <div
            className="grid min-h-0 flex-1 grid-cols-7 gap-1.5 md:gap-2"
            style={{
              gridTemplateRows: fillHeight
                ? `repeat(${weeks.length}, minmax(0, 1fr))`
                : `repeat(${weeks.length}, minmax(70px, 1fr))`,
            }}
          >
            {weeks.map((week, weekIndex) => (
              <Fragment key={weekIndex}>
                {week.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const dayTrades = byDay.get(key) ?? [];
                  const pnl = dayPnl(key);
                  const inMonth = isSameMonth(day, monthDate);
                  const today = isToday(day);
                  const hasTrades = dayTrades.length > 0;

                  return (
                    <button
                      key={key}
                      onClick={() => (hasTrades ? setSelectedDay(key) : openAddForDay(key))}
                      className={`flex min-h-0 flex-col items-start rounded-xl border p-1 text-left transition sm:p-2 xl:p-2.5 ${
                        inMonth ? "border-[var(--border)]" : "border-transparent opacity-40"
                      } cursor-pointer hover:border-[var(--accent)]`}
                      style={{
                        background: hasTrades
                          ? pnl >= 0
                            ? "var(--gradient-profit-soft)"
                            : "var(--gradient-loss-soft)"
                          : today
                            ? "var(--border)"
                            : "var(--surface-2)",
                      }}
                    >
                      <span className={`shrink-0 text-xs font-medium ${inMonth ? "text-[var(--text-muted)]" : "text-[var(--text-faint)]"}`}>
                        {format(day, "d")}
                      </span>
                      {hasTrades && (
                        <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-0.5 text-center">
                          <div
                            className={`w-full truncate font-bold leading-tight tabular tracking-tight ${
                              fillHeight ? "text-[10px] sm:text-base md:text-lg xl:text-xl" : "text-[10px] 2xl:text-base"
                            } ${
                              pnl >= 0 ? "text-[var(--profit)]" : "text-[var(--loss)]"
                            }`}
                          >
                            {pnl >= 0 ? "+" : "-"}
                            {formatCurrency(Math.abs(pnl))}
                          </div>
                          <div className="truncate whitespace-nowrap text-[9px] text-[var(--text-muted)] sm:text-[11px]">
                            {dayTrades.length} trade{dayTrades.length > 1 ? "s" : ""}
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </Fragment>
            ))}
          </div>

          <div
            className="hidden min-h-0 flex-col gap-1.5 md:flex md:shrink-0 md:grow-0 md:basis-[13%] md:gap-2 md:border-l md:border-[var(--border)] md:pl-4"
          >
            {weeks.map((week, weekIndex) => {
              const weekTrades = week.flatMap((d) => byDay.get(format(d, "yyyy-MM-dd")) ?? []);
              const weekPnl = weekTrades.reduce((s, t) => s + (t.pnl - t.fees), 0);

              return (
                <div
                  key={weekIndex}
                  className="flex min-h-0 flex-1 flex-col items-start rounded-xl border border-[var(--border)] p-2.5"
                  style={{
                    minHeight: fillHeight ? 0 : 70,
                    background:
                      weekTrades.length === 0
                        ? "var(--surface-2)"
                        : weekPnl >= 0
                          ? "var(--gradient-profit-soft)"
                          : "var(--gradient-loss-soft)",
                  }}
                >
                  <span className="shrink-0 text-xs font-medium text-[var(--text-muted)]">Weekly</span>
                  <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-0.5 text-center">
                    <div
                      className={`w-full truncate font-bold leading-tight tabular ${
                        fillHeight ? "text-2xl" : "text-sm 2xl:text-base"
                      } ${
                        weekTrades.length === 0
                          ? "text-[var(--text-faint)]"
                          : weekPnl >= 0
                            ? "text-[var(--profit)]"
                            : "text-[var(--loss)]"
                      }`}
                    >
                      {weekTrades.length > 0 && (weekPnl >= 0 ? "+" : "-")}
                      {formatCurrency(Math.abs(weekPnl))}
                    </div>
                    <div className="truncate whitespace-nowrap text-[11px] text-[var(--text-muted)]">
                      {weekTrades.length} trade{weekTrades.length === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm md:items-center" onClick={() => setSelectedDay(null)}>
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl md:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--text)]">
                <CalendarDays size={15} className="text-[var(--accent)]" />
                {format(parseISO(`${selectedDay}T00:00:00`), "EEEE, MMMM d")}
              </h2>
              <button
                onClick={() => setSelectedDay(null)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-2)] cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>
            <div className="flex flex-col gap-2 p-4">
              {selectedTrades.map((t) => {
                const net = t.pnl - t.fees;
                const account = accountById.get(t.accountId);
                return (
                  <button
                    key={t.id}
                    onClick={() => openEdit(t)}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-3 text-left hover:border-[var(--accent)] cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                          t.isBreakeven
                            ? "bg-[var(--surface-2)] text-[var(--text-faint)]"
                            : net >= 0
                              ? "[background-image:var(--gradient-profit-soft)] text-[var(--profit)]"
                              : "[background-image:var(--gradient-loss-soft)] text-[var(--loss)]"
                        }`}
                      >
                        {t.isBreakeven ? (
                          <Minus size={14} />
                        ) : net >= 0 ? (
                          <TrendingUp size={14} />
                        ) : (
                          <TrendingDown size={14} />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-medium text-[var(--text)]">
                          {t.symbol}
                          <Badge tone={t.side === "LONG" ? "profit" : "loss"}>{t.side}</Badge>
                          {t.isBreakeven && <Badge tone="neutral">BE</Badge>}
                        </div>
                        <div className="truncate text-xs text-[var(--text-muted)]">
                          {account?.name} · {t.contracts} contract{t.contracts > 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>
                    <div className={`shrink-0 text-sm font-semibold tabular ${net >= 0 ? "text-[var(--profit)]" : "text-[var(--loss)]"}`}>
                      {net >= 0 ? "+" : ""}
                      {formatCurrency(net)}
                    </div>
                  </button>
                );
              })}
              <button
                onClick={() => openAddForDay(selectedDay)}
                className="mt-1 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--border)] p-3 text-sm font-medium text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] cursor-pointer"
              >
                <PlusCircle size={15} />
                Add trade on this day
              </button>
            </div>
          </div>
        </div>
      )}

      <TradeForm
        key={formKey}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        accounts={accounts}
        trade={editing}
        timeZone={timeZone}
        defaultDate={selectedDay ?? undefined}
      />
    </div>
  );
}
