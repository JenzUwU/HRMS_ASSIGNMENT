"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/solid";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { getRecruiterNotifications } from "@/lib/api";
import {
  MOCK_NOTIFICATIONS,
  toAppNotification,
  type AppNotification,
} from "@/lib/notifications";

export default function NotificationsPage() {
  const [items, setItems] = useState<AppNotification[]>(MOCK_NOTIFICATIONS);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let active = true;
    getRecruiterNotifications(50)
      .then((rows) => {
        if (!active) return;
        if (rows.length > 0) {
          setItems(rows.map(toAppNotification));
          setLive(true);
        }
      })
      .catch(() => {
        /* keep mock fallback */
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <AppShell title="Notifications">
      <Card className="max-w-2xl p-0">
        <div className="px-5 pt-5">
          <h2 className="font-heading text-base font-semibold text-charcoal">
            All Notifications
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {live
              ? "Recruiter notifications from candidate events."
              : "Prototype feed built from current candidate activity."}
          </p>
        </div>
        <ul className="mt-3 divide-y divide-border">
          {items.map((n) => (
            <li key={n.id}>
              <Link
                href={n.href}
                className="group flex items-center gap-3 px-5 py-4 transition-colors hover:bg-peach/30"
              >
                <Avatar initials={n.initials} size="sm" tone="peach" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-charcoal group-hover:text-orange">
                    {n.title}
                  </p>
                  <p className="truncate text-xs text-text-secondary">
                    {n.reason}
                  </p>
                </div>
                <span className="whitespace-nowrap text-[11px] text-text-secondary">
                  {n.timeLabel}
                </span>
                <ArrowRightIcon className="h-4 w-4 shrink-0 text-text-secondary group-hover:text-orange" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </AppShell>
  );
}
