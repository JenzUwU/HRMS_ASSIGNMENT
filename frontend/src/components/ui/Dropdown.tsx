"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Small controlled dropdown: a trigger button + a glass panel. Handles
 * outside-click, Escape, and the entrance animation. Used for the candidate
 * table's Columns / Sort popovers and similar lightweight menus.
 */
export function Dropdown({
  label,
  icon,
  children,
  align = "right",
  active,
  panelClassName,
}: {
  label: ReactNode;
  icon?: ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  active?: boolean;
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition-all duration-150",
          "hover:-translate-y-px hover:border-orange/40 hover:bg-peach/30 active:translate-y-0",
          open || active
            ? "border-orange/50 bg-peach/40 text-orange"
            : "border-border text-charcoal",
        )}
      >
        {icon}
        {label}
      </button>

      {open && (
        <div
          id={id}
          role="menu"
          className={cn(
            "animate-menu-in absolute top-full z-40 mt-2 min-w-[220px] rounded-xl p-1.5",
            "border border-white/70 bg-white/90 ring-1 ring-black/5",
            "shadow-[0_18px_44px_-12px_rgba(203,110,40,0.22)] backdrop-blur-xl backdrop-saturate-150",
            align === "right" ? "right-0" : "left-0",
            panelClassName,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
