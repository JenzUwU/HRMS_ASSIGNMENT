"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EllipsisVerticalIcon } from "@heroicons/react/24/solid";
import { GlassIcon, type GlassIconName } from "@/components/ui/GlassIcon";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/cn";

/**
 * "More Actions" dropdown on the candidate detail header. Labeled trigger plus a
 * solid-white menu of existing routes / clipboard helpers. No backend calls.
 */
export function CandidateMoreActions({
  slug,
  email,
  phone,
}: {
  slug: string;
  email?: string | null;
  phone?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const id = useId();

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

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function copy(value: string | null | undefined, label: string) {
    setOpen(false);
    if (!value) {
      toast(`No ${label} on file`, "error");
      return;
    }
    navigator.clipboard
      ?.writeText(value)
      .then(() => toast(`${label} copied`, "success"))
      .catch(() => toast("Could not copy", "error"));
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors",
          open
            ? "border-orange/50 bg-peach/40 text-orange"
            : "border-border text-charcoal hover:bg-cream",
        )}
      >
        <EllipsisVerticalIcon className="h-4 w-4" />
        More Actions
      </button>

      {open && (
        <div
          id={id}
          role="menu"
          className={cn(
            "animate-menu-in absolute right-0 top-full z-40 mt-2 w-60 rounded-xl p-1.5",
            "border border-border bg-white ring-1 ring-black/5",
            "shadow-[0_18px_44px_-12px_rgba(203,110,40,0.22)]",
          )}
        >
          <Item glass="tasks" onClick={() => go(`/engagement-journey?candidate=${slug}`)}>
            View Engagement Journey
          </Item>
          <Item glass="messages" onClick={() => go(`/communication?candidate=${slug}`)}>
            Open Communication
          </Item>
          <div className="my-1 h-px bg-black/[0.06]" />
          <Item glass="email" onClick={() => copy(email, "Email")}>
            Copy Email
          </Item>
          <Item glass="phone_number" onClick={() => copy(phone, "Phone number")}>
            Copy Phone Number
          </Item>
        </div>
      )}
    </div>
  );
}

function Item({
  children,
  onClick,
  glass,
}: {
  children: React.ReactNode;
  onClick: () => void;
  glass: GlassIconName;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-charcoal transition-colors hover:bg-peach/50 hover:text-orange"
    >
      <GlassIcon name={glass} size={18} />
      {children}
    </button>
  );
}
