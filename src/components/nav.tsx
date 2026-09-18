"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutDashboard, CalendarDays, ListOrdered, Wallet, Settings, ShieldCheck } from "lucide-react";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/trades", label: "Trades", icon: ListOrdered },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();

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

      <div className="mt-auto flex items-start gap-1.5 px-6 py-6 text-xs text-[var(--text-faint)]">
        <ShieldCheck size={14} className="mt-0.5 shrink-0" />
        Local &amp; private, your data never leaves this machine.
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-[var(--border)] bg-[var(--bg-elevated)] md:hidden">
      {links.map((link) => {
        const active =
          link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        const Icon = link.icon;
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
    </nav>
  );
}
