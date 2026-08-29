"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightStartOnRectangleIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/solid";
import { Avatar } from "@/components/ui/Avatar";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/auth";

const ITEMS: { label: string; href?: string; note?: string }[] = [
  { label: "Profile", note: "Profile view is a prototype stub." },
  { label: "Account Settings", note: "Account settings aren't wired in the prototype." },
  { label: "Preferences", note: "Preferences aren't wired in the prototype." },
  { label: "Notification Settings", href: "/notifications" },
];

function initialsOf(name: string | null, email: string | null): string {
  const src = (name || email || "").trim();
  if (!src) return "HR";
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export function UserMenu() {
  const router = useRouter();
  const { fullName, email, role, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const displayName = fullName || email || "HR User";
  const initials = initialsOf(fullName, email);

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
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className={cn(
          "flex cursor-pointer items-center gap-2 rounded-xl px-1.5 py-1 transition-colors",
          "hover:bg-peach/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/40",
          open && "bg-peach/50",
        )}
      >
        <Avatar initials={initials} size="md" />
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-[160px] truncate text-sm font-semibold text-charcoal">
            {displayName}
          </span>
          <span className="block text-xs text-text-secondary">
            {role ?? "HR"}
          </span>
        </span>
        <ChevronDownIcon
          className={cn(
            "h-4 w-4 text-text-secondary transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className={cn(
            "animate-menu-in absolute right-0 top-full z-40 mt-2 w-56 rounded-xl p-1.5",
            "border border-border bg-white ring-1 ring-black/5",
            "shadow-[0_18px_44px_-12px_rgba(203,110,40,0.22)]",
          )}
        >
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-semibold text-charcoal">
              {displayName}
            </p>
            <p className="truncate text-xs text-text-secondary">
              {role ?? "HR"}
              {email ? ` · ${email}` : ""}
            </p>
          </div>
          <div className="my-1 h-px bg-black/[0.06]" />
          {ITEMS.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                if (it.href) router.push(it.href);
                else if (it.note) toast(it.note);
              }}
              className="flex w-full cursor-pointer items-center rounded-lg px-2.5 py-2 text-left text-sm font-medium text-charcoal transition-colors hover:bg-peach/50 hover:text-orange"
            >
              {it.label}
            </button>
          ))}
          <div className="my-1 h-px bg-black/[0.06]" />
          <button
            type="button"
            role="menuitem"
            disabled={signingOut}
            onClick={async () => {
              if (signingOut) return;
              setSigningOut(true);
              setOpen(false);
              await signOut();
              toast("Signed out", "success");
              router.replace("/login");
              router.refresh();
            }}
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-coral transition-colors hover:bg-coral/10 disabled:opacity-60"
          >
            <ArrowRightStartOnRectangleIcon className="h-4 w-4" />
            {signingOut ? "Signing out…" : "Sign Out"}
          </button>
        </div>
      )}
    </div>
  );
}
