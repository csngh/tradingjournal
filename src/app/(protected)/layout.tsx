import { Suspense } from "react";
import { Sidebar, MobileNav } from "@/components/nav";
import { AccountFilter } from "@/components/account-filter";
import { ThemeToggle } from "@/components/theme-toggle";
import { LockButton } from "@/components/lock-button";
import { getAllAccounts } from "@/lib/data";

export default async function ProtectedLayout({ children }: LayoutProps<"/">) {
  const accounts = await getAllAccounts();

  return (
    <>
      <div className="flex h-full">
        <Suspense fallback={<div className="hidden md:w-60 md:flex" />}>
          <Sidebar />
        </Suspense>

        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          <header className="relative z-20 flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--bg)]/80 px-4 py-3 backdrop-blur md:px-8">
            <div className="text-sm font-medium text-[var(--text-muted)] md:hidden">
              Gringotts Trading Journal
            </div>
            <div className="hidden md:block" />
            <div className="flex items-center gap-3">
              <Suspense fallback={<div className="h-9 w-32 rounded-full bg-[var(--surface-2)]" />}>
                <AccountFilter accounts={accounts} />
              </Suspense>
              <ThemeToggle />
              <LockButton />
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 pb-24 md:px-8 md:py-6 md:pb-6">
            {children}
          </main>
        </div>
      </div>

      <Suspense fallback={null}>
        <MobileNav />
      </Suspense>
    </>
  );
}
