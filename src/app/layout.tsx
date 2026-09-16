import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Sidebar, MobileNav } from "@/components/nav";
import { AccountFilter } from "@/components/account-filter";
import { ThemeToggle } from "@/components/theme-toggle";
import { getAllAccounts } from "@/lib/data";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Futures Journal",
  description: "A clean, modern futures trading journal.",
};

const themeScript = `
(function () {
  try {
    var theme = localStorage.getItem("theme") || "dark";
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
})();
`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const accounts = await getAllAccounts();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="h-screen overflow-hidden bg-[var(--bg)] text-[var(--text)]">
        <div className="flex h-full">
          <Suspense fallback={<div className="hidden md:w-60 md:flex" />}>
            <Sidebar />
          </Suspense>

          <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
            <header className="relative z-20 flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--bg)]/80 px-4 py-3.5 backdrop-blur md:px-8">
              <div className="text-sm font-medium text-[var(--text-muted)] md:hidden">
                Futures Journal
              </div>
              <div className="hidden md:block" />
              <div className="flex items-center gap-3">
                <Suspense fallback={<div className="h-9 w-32 rounded-full bg-[var(--surface-2)]" />}>
                  <AccountFilter accounts={accounts} />
                </Suspense>
                <ThemeToggle />
              </div>
            </header>

            <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 pb-24 md:px-8 md:py-8 md:pb-8">
              {children}
            </main>
          </div>
        </div>

        <Suspense fallback={null}>
          <MobileNav />
        </Suspense>
      </body>
    </html>
  );
}
