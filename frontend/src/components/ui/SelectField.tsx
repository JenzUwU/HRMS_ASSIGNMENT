"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/24/solid";
import { cn } from "@/lib/cn";

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Custom single-select that matches the HRMS design language (solid white panel,
 * orange / cream accents, rounded corners). Replaces the native <select> so the
 * option list is not rendered by the OS. Keyboard: Enter/Space opens, Escape
 * closes, click-outside closes.
 */
export function SelectField({
  label,
  value,
  options,
  onChange,
  icon,
  placeholder = "All",
  className,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  icon?: ReactNode;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const all: SelectOption[] = [{ value: "", label: placeholder }, ...options];
  const selected = all.find((o) => o.value === value) ?? all[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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
    <div ref={rootRef} className={cn("relative", className)}>
      <span className="text-xs font-semibold text-text-secondary">{label}</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "mt-1.5 flex w-full cursor-pointer items-center gap-2 rounded-xl border bg-surface px-3 py-2.5 text-left text-sm transition-colors",
          open
            ? "border-orange ring-2 ring-orange/15"
            : "border-border hover:border-orange/40",
        )}
      >
        {icon}
        <span className="flex-1 truncate text-charcoal">{selected.label}</span>
        <ChevronDownIcon
          className={cn(
            "h-4 w-4 shrink-0 text-text-secondary transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <ul
          id={id}
          role="listbox"
          className={cn(
            "animate-menu-in absolute left-0 right-0 top-full z-40 mt-1.5 max-h-64 overflow-auto rounded-xl p-1.5",
            "border border-border bg-white ring-1 ring-black/5",
            "shadow-[0_18px_44px_-12px_rgba(203,110,40,0.22)]",
          )}
        >
          {all.map((o) => {
            const active = o.value === value;
            return (
              <li key={o.value || "__placeholder"} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                    active
                      ? "bg-peach/60 font-semibold text-orange"
                      : "text-charcoal hover:bg-peach/35 hover:text-orange",
                  )}
                >
                  <span className="truncate">{o.label}</span>
                  {active && <CheckIcon className="h-4 w-4 shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
