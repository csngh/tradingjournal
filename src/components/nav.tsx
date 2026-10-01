"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { primaryButtonClass } from "@/components/ui/form";
import { BACKTEST_ENABLED } from "@/lib/features";
import { LayoutDashboard, CalendarDays, ListOrdered, Wallet, FlaskConical, Settings, ShieldCheck } from "lucide-react";

type NavLink = { href: string; label: string; icon: typeof LayoutDashboard; soon?: boolean };

// A link marked `soon` stays visible but is disabled: clicking it opens a "Coming soon" popup.
const links: NavLink[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/trades", label: "Trades", icon: ListOrdered },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/backtest", label: "Backtest", icon: FlaskConical, soon: !BACKTEST_ENABLED },
  { href: "/settings", label: "Settings", icon: Settings },
];

function ComingSoonModal({ label, open, onClose }: { label: string; open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={`${label}: coming soon`} icon={FlaskConical} width="max-w-sm">
      <div className="flex flex-col gap-4 text-sm">
        <p className="text-[var(--text-muted)]">
          Backtesting isn&apos;t available yet. You will be able to create strategies, log backtested trades and get
          a full analysis right here once it&apos;s ready.
        </p>
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className={primaryButtonClass}>
            Got it
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const [soonLabel, setSoonLabel] = useState<string | null>(null);

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-[var(--border)] md:bg-[var(--bg-elevated)]">
      <div className="flex items-center gap-2.5 px-6 py-6">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black">
          <Image src="/logo.png" alt="Gringotts Trading Journal" width={32} height={32} className="h-full w-full object-cover" />
        </div>
        <span className="min-w-0 flex-1 text-[13px] font-semibold leading-tight tracking-tight text-[var(--text)]">
          Gringotts Trading Journal
        </span>
      </div>

      <nav className="flex flex-col gap-1 px-3">
        {links.map((link) => {
          const active =
            link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          const Icon = link.icon;
          if (link.soon) {
            return (
              <button
                key={link.href}
                type="button"
                aria-haspopup="dialog"
                onClick={() => setSoonLabel(link.label)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[var(--text-faint)] transition hover:bg-[var(--surface-2)]"
              >
                <Icon size={17} />
                {link.label}
                <span className="ml-auto rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Soon
                </span>
              </button>
            );
          }
          return (
            <Link
              key={link.href}
              href={qs ? `${link.href}?${qs}` : link.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active
                  ? "[background-image:var(--gradient-accent-soft)] text-[var(--accent)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                }`}
            >
              <Icon size={17} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-2 px-6 py-6">
        <div className="flex items-start gap-1.5 text-xs text-[var(--text-faint)]">
          <ShieldCheck size={14} className="mt-0.5 shrink-0" />
          Local &amp; private, your data never leaves this machine.
        </div>
        <p className="text-[11px] text-[var(--text-faint)]">Made with ❤️ by Bros for Bros.</p>
      </div>

      <ComingSoonModal label={soonLabel ?? ""} open={soonLabel !== null} onClose={() => setSoonLabel(null)} />
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const [soonLabel, setSoonLabel] = useState<string | null>(null);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-[var(--border)] bg-[var(--bg-elevated)] md:hidden">
      {links.map((link) => {
        const active =
          link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        const Icon = link.icon;
        if (link.soon) {
          return (
            <button
              key={link.href}
              type="button"
              aria-haspopup="dialog"
              onClick={() => setSoonLabel(link.label)}
              className="flex flex-1 cursor-pointer flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-[var(--text-faint)]"
            >
              <Icon size={18} />
              {link.label}
            </button>
          );
        }
        return (
          <Link
            key={link.href}
            href={qs ? `${link.href}?${qs}` : link.href}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${active ? "text-[var(--accent)]" : "text-[var(--text-muted)]"
              }`}
          >
            <Icon size={18} />
            {link.label}
          </Link>
        );
      })}
      <ComingSoonModal label={soonLabel ?? ""} open={soonLabel !== null} onClose={() => setSoonLabel(null)} />
    </nav>
  );
}
