"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { CheckCircleIcon, EllipsisVerticalIcon } from "@heroicons/react/24/solid";
import { GlassIcon, type GlassIconName } from "@/components/ui/GlassIcon";
import { cn } from "@/lib/cn";

/**
 * Row action menu for the dashboard "Candidates Needing Attention" table.
 * One reusable instance per row. Navigation items use the existing routes;
 * "Add Note" and "Mark as Resolved" are delegated to the parent so state
 * (notes, resolved rows) lives in one place.
 */
export function CandidateActionMenu({
  slug,
  onAddNote,
  onResolve,
}: {
  slug: string;
  onAddNote?: () => void;
  onResolve?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const MENU_W = 236;

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({
      top: Math.round(r.bottom + 8),
      left: Math.round(Math.max(8, r.right - MENU_W)),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    const close = () => setOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const navigate = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Candidate actions"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center justify-center rounded-lg p-1.5 text-text-secondary",
          "transition duration-150 hover:bg-peach/60 hover:text-orange",
          "hover:scale-110 active:scale-95",
          open && "bg-peach/60 text-orange",
        )}
      >
        <EllipsisVerticalIcon className="h-4 w-4" />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ position: "fixed", top: pos.top, left: pos.left, width: MENU_W }}
            className={cn(
              "z-50 origin-top-right rounded-2xl border border-white/70 bg-white/85 p-1.5",
              "shadow-[0_24px_60px_-16px_rgba(41,41,41,0.28)] ring-1 ring-black/5",
              "backdrop-blur-xl backdrop-saturate-150",
              "animate-[menuIn_120ms_ease-out]",
            )}
          >
            <MenuItem
              glass="employee-details"
              onClick={() => navigate(`/candidates/${slug}`)}
            >
              View Candidate
            </MenuItem>
            <MenuItem
              glass="tasks"
              onClick={() =>
                navigate(`/engagement-journey?candidate=${slug}`)
              }
            >
              View Engagement Journey
            </MenuItem>
            <MenuItem
              glass="messages"
              onClick={() => navigate(`/communication?candidate=${slug}`)}
            >
              Open Communication
            </MenuItem>
            <MenuItem
              glass="tasks"
              onClick={() =>
                navigate(`/engagement-journey?candidate=${slug}#tasks`)
              }
            >
              View Tasks
            </MenuItem>
            {onAddNote && (
              <MenuItem
                glass="documents"
                onClick={() => {
                  setOpen(false);
                  onAddNote();
                }}
              >
                Add Note
              </MenuItem>
            )}

            {onResolve && <div className="my-1 h-px bg-black/[0.06]" />}

            {onResolve && (
            <MenuItem
              danger
              onClick={() => {
                setOpen(false);
                onResolve();
              }}
            >
              Mark Attention Resolved
            </MenuItem>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

function MenuItem({
  children,
  onClick,
  glass,
  danger,
}: {
  children: ReactNode;
  onClick: () => void;
  glass?: GlassIconName;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium transition-colors",
        danger
          ? "text-coral hover:bg-coral/10"
          : "text-charcoal hover:bg-peach/50 hover:text-orange",
      )}
    >
      {danger ? (
        <CheckCircleIcon className="h-[18px] w-[18px]" />
      ) : glass ? (
        <GlassIcon name={glass} size={18} />
      ) : null}
      {children}
    </button>
  );
}
