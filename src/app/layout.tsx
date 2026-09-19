import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gringotts Trading Journal",
  description: "A clean, modern futures trading journal.",
};

const themeScript = `
(function () {
  try {
    var theme = localStorage.getItem("theme") || "dark";
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
  if (/Electron/.test(navigator.userAgent) && /Mac/.test(navigator.userAgent)) {
    document.documentElement.classList.add("electron-mac");
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
        {children}
      </body>
    </html>
  );
}
