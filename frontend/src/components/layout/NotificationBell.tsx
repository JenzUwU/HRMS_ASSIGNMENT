"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/solid";
import { cn } from "@/lib/cn";
import { GlassIcon } from "@/components/ui/GlassIcon";
import { Avatar } from "@/components/ui/Avatar";
import { MOCK_NOTIFICATIONS, type AppNotification } from "@/lib/notifications";

/**
 * Interactive notification bell + glassmorphism dropdown.
 *
 * Read / unread is local component state so the mock feed can later be swapped
 * for a real one by passing a different `notifications` array. The bell icon and
 * badge markup are unchanged from the original Topbar.
 */
export function NotificationBell({
  notifications = MOCK_NOTIFICATIONS,
}: {
  notifications?: AppNotification[];
}) {
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(
    (n) => !readIds.includes(n.id),
  ).length;

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function markRead(id: string) {
    setReadIds((cur) => (cur.includes(id) ? cur : [...cur, id]));
  }
  function markAllRead() {
    setReadIds(notifications.map((n) => n.id));
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-charcoal hover:bg-peach/60"
      >
        <GlassIcon name="notifications" size={20} />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-orange text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Notifications"
          className={cn(
            "absolute right-0 top-12 z-40 w-80 origin-top-right rounded-xl p-2",
            "border border-border bg-white ring-1 ring-black/5",
            "shadow-[0_1px_2px_rgba(41,41,41,0.04),0_18px_44px_-12px_rgba(203,110,40,0.22)]",
          )}
        >
          <div className="flex items-center justify-between px-2 py-1.5">
            <p className="font-heading text-sm font-semibold text-charcoal">
              Notifications
            </p>
            <button
              type="button"
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="cursor-pointer text-xs font-semibold text-orange transition-colors hover:text-orange/80 disabled:cursor-not-allowed disabled:text-text-secondary"
            >
              Mark all as read
            </button>
          </div>

          <ul className="mt-1 space-y-1">
            {notifications.map((n) => {
              const isRead = readIds.includes(n.id);
              return (
                <li key={n.id}>
                  <Link
                    href={n.href}
                    role="menuitem"
                    onClick={() => {
                      markRead(n.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "group flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 transition duration-200",
                      "hover:-translate-y-0.5 hover:bg-peach/40 hover:shadow-[0_6px_16px_-8px_rgba(41,41,41,0.15)]",
                      "focus-visible:bg-peach/40 focus-visible:outline-none",
                      isRead && "opacity-55",
                    )}
                  >
                    <span className="relative shrink-0">
                      <Avatar initials={n.initials} size="sm" tone="peach" />
                      {!isRead && (
                        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-orange" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-charcoal group-hover:text-orange">
                        {n.title}
                      </span>
                      <span className="block truncate text-xs text-text-secondary">
                        {n.reason}
                      </span>
                    </span>
                    <span className="whitespace-nowrap text-[11px] text-text-secondary">
                      {n.timeLabel}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="mt-1 flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-cream/70 py-2 text-xs font-semibold text-orange hover:bg-peach/60"
          >
            View all notifications
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
