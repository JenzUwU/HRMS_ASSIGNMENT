"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUturnLeftIcon,
  BookmarkIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  FaceSmileIcon,
  FunnelIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  PlusIcon,
  UserGroupIcon,
} from "@heroicons/react/24/solid";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { chatThread, conversations } from "@/lib/mock-data";

const tabs = ["Inbox", "Sent", "Scheduled", "Templates"];

export default function CommunicationPage() {
  const [tab, setTab] = useState(tabs[0]);
  const [activeId, setActiveId] = useState(conversations[0].id);
  const active = conversations.find((c) => c.id === activeId)!;

  const overview = [
    { label: "Messages Sent", value: "8", icon: EnvelopeIcon },
    { label: "Replies Received", value: "6", icon: ArrowUturnLeftIcon },
    { label: "Avg. Response Time", value: "6h 20m", icon: ClockIcon },
  ];

  const channels = [
    { label: "Email", value: active.name.toLowerCase().replace(" ", ".") + "@email.com", on: true },
    { label: "SMS", value: "+91 98765 43210", on: false },
    { label: "WhatsApp", value: "+91 98765 43210", on: false },
  ];

  return (
    <AppShell title="Communication" searchPlaceholder="Search candidates, messages, templates...">
      <div className="mb-4 flex items-center justify-between">
        <nav className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-orange">Communication</span>
          <ChevronRightIcon className="h-3.5 w-3.5 text-text-secondary" />
          <span className="font-semibold text-charcoal">Inbox</span>
        </nav>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-charcoal hover:bg-cream">
            <DocumentTextIcon className="h-4 w-4" />
            Message Templates
          </button>
          <button className="flex items-center gap-2 rounded-xl bg-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange/90">
            <PlusIcon className="h-4 w-4" />
            New Message
          </button>
        </div>
      </div>

      <div className="mb-4 flex gap-5 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              t === tab
                ? "border-b-2 border-orange pb-3 text-sm font-semibold text-orange"
                : "border-b-2 border-transparent pb-3 text-sm font-semibold text-text-secondary hover:text-charcoal"
            }
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_1fr_300px]">
        <Card className="flex flex-col p-0">
          <div className="border-b border-border p-4">
            <p className="font-heading text-base font-semibold text-charcoal">
              Conversations
            </p>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-text-secondary">
              <input
                placeholder="Search by name or email..."
                className="w-full bg-transparent outline-none"
              />
              <FunnelIcon className="h-4 w-4" />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-text-secondary">
              <span className="rounded-lg border border-border px-2 py-1">
                All Status
              </span>
              <span>Sort: Latest</span>
            </div>
          </div>
          <ul className="flex-1 overflow-y-auto">
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setActiveId(c.id)}
                  className={
                    c.id === activeId
                      ? "flex w-full gap-3 border-l-2 border-orange bg-peach/30 px-4 py-3 text-left"
                      : "flex w-full gap-3 border-l-2 border-transparent px-4 py-3 text-left hover:bg-cream/60"
                  }
                >
                  <Avatar initials={c.initials} size="md" online={c.online} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="truncate text-sm font-semibold text-charcoal">
                        {c.name}
                      </span>
                      <span className="ml-2 flex items-center gap-1 whitespace-nowrap text-[11px] text-text-secondary">
                        {c.unread && (
                          <span className="h-1.5 w-1.5 rounded-full bg-orange" />
                        )}
                        {c.time}
                      </span>
                    </div>
                    <p className="truncate text-xs font-medium text-text-secondary">
                      {c.subject}
                    </p>
                    <p className="truncate text-xs text-text-secondary">
                      {c.preview}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-border px-4 py-3 text-xs text-text-secondary">
            Showing 1 to 7 of 248 conversations
          </div>
        </Card>

        <Card className="flex flex-col p-0">
          <div className="flex items-center justify-between border-b border-border p-4">
            <div className="flex items-center gap-3">
              <Avatar initials={active.initials} size="md" online />
              <div>
                <p className="text-sm font-semibold text-charcoal">
                  {active.name}
                </p>
                <p className="text-xs text-text-secondary">
                  Product Analyst, Bengaluru
                </p>
              </div>
            </div>
            <Link
              href={`/candidates/${active.candidateId}`}
              className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-charcoal hover:bg-cream"
            >
              View Candidate
            </Link>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto bg-cream/40 p-5">
            {chatThread.map((m, i) => {
              const showDate =
                i === 0 || chatThread[i - 1].dateLabel !== m.dateLabel;
              return (
                <div key={m.id}>
                  {showDate && (
                    <p className="my-3 text-center text-xs font-medium text-text-secondary">
                      {m.dateLabel}
                    </p>
                  )}
                  <div
                    className={
                      m.from === "hr" ? "flex justify-start" : "flex justify-end"
                    }
                  >
                    <div
                      className={
                        m.from === "hr"
                          ? "max-w-[75%] rounded-2xl rounded-tl-sm bg-peach/60 px-4 py-3 text-sm text-charcoal"
                          : "max-w-[75%] rounded-2xl rounded-tr-sm bg-teal/15 px-4 py-3 text-sm text-charcoal"
                      }
                    >
                      <p className="mb-1 text-[11px] font-semibold text-text-secondary">
                        {m.author} · {m.time}
                      </p>
                      {m.body}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border p-4">
            <div className="mb-2 flex gap-4 text-sm">
              <span className="font-semibold text-orange">Message</span>
              <span className="font-semibold text-text-secondary">
                Note (Internal)
              </span>
            </div>
            <div className="rounded-xl border border-border p-3">
              <input
                placeholder="Type your message..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-text-secondary"
              />
              <div className="mt-3 flex items-center justify-between text-text-secondary">
                <div className="flex gap-3">
                  <PaperClipIcon className="h-4 w-4" />
                  <DocumentTextIcon className="h-4 w-4" />
                  <FaceSmileIcon className="h-4 w-4" />
                  <BookmarkIcon className="h-4 w-4" />
                </div>
                <button className="flex items-center gap-2 rounded-lg bg-orange px-4 py-2 text-sm font-semibold text-white">
                  <PaperAirplaneIcon className="h-4 w-4" />
                  Send
                </button>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-base font-semibold text-charcoal">
                Engagement Overview
              </h3>
              <span className="text-sm font-semibold text-orange">
                View Details
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {overview.map((o) => (
                <div key={o.label} className="rounded-xl bg-cream/70 p-3">
                  <o.icon className="mx-auto h-4 w-4 text-orange" />
                  <p className="mt-1 font-heading text-lg font-bold text-charcoal">
                    {o.value}
                  </p>
                  <p className="text-[10px] leading-tight text-text-secondary">
                    {o.label}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-text-secondary">Response Rate</p>
            <div className="mt-1 h-2 w-full rounded-full bg-border">
              <div className="h-full w-3/4 rounded-full bg-teal" />
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-base font-semibold text-charcoal">
                Candidate Status
              </h3>
              <Badge tone="teal">Active</Badge>
            </div>
            <dl className="mt-3 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-secondary">Current Stage</dt>
                <dd className="font-semibold text-charcoal">Documentation</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-secondary">Last Interaction</dt>
                <dd className="font-semibold text-charcoal">Today, 11:25 AM</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-secondary">Preferred Channel</dt>
                <dd className="font-semibold text-charcoal">Email</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-secondary">Communication Score</dt>
                <dd className="font-semibold text-teal">4.2/5</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h3 className="font-heading text-base font-semibold text-charcoal">
              Preferred Channels
            </h3>
            <ul className="mt-3 space-y-2.5 text-sm">
              {channels.map((ch) => (
                <li key={ch.label} className="flex items-center gap-2">
                  <span
                    className={
                      ch.on
                        ? "flex h-4 w-4 items-center justify-center rounded bg-orange text-white"
                        : "h-4 w-4 rounded border border-border"
                    }
                  >
                    {ch.on && <CheckCircleIcon className="h-3 w-3" />}
                  </span>
                  <span className="font-medium text-charcoal">{ch.label}</span>
                  <span className="ml-auto text-xs text-text-secondary">
                    {ch.value}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h3 className="font-heading text-base font-semibold text-charcoal">
              Quick Actions
            </h3>
            <div className="mt-3 space-y-2">
              {[
                { label: "Send Document Reminder", icon: DocumentTextIcon },
                { label: "Schedule Check-in", icon: CalendarDaysIcon },
                { label: "Share Pre-Joining Resources", icon: UserGroupIcon },
              ].map((a) => (
                <button
                  key={a.label}
                  className="flex w-full items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold text-charcoal hover:bg-cream"
                >
                  <a.icon className="h-4 w-4 text-orange" />
                  {a.label}
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
