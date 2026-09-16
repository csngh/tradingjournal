"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import type { ComponentType, ReactNode } from "react";

export function Modal({
  open,
  onClose,
  title,
  icon: Icon,
  children,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  children: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-10 backdrop-blur-sm md:pt-16">
      <div
        className={`w-full ${width} rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--text)]">
            {Icon && <Icon size={16} className="text-[var(--accent)]" />}
            {title}
          </h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-2)] cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}
