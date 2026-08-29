"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  ExclamationTriangleIcon,
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
import { ApiError } from "@/lib/api-client";
import {
  getCandidate,
  getConversationThread,
  getConversations,
  getMessageTemplates,
  type CandidateDetail,
  type Conversation,
  type ConversationThread,
  type Message,
  type MessageTemplate,
} from "@/lib/api";
import {
  CHANNEL_LABEL,
  STAGE_LABEL,
  STATUS_LABEL,
  formatDate,
  relativeDays,
  relativeTime,
} from "@/lib/format";

const TABS = ["Inbox", "Sent", "Scheduled", "Templates"] as const;
type Tab = (typeof TABS)[number];

function isHrMessage(m: Message) {
  return m.direction === "outbound" || m.actor !== "candidate";
}

export default function CommunicationPage() {
  const [tab, setTab] = useState<Tab>("Inbox");
  const [search, setSearch] = useState("");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [total, setTotal] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [thread, setThread] = useState<ConversationThread | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);

  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await getConversations(1, 50);
      setConversations(res.items);
      setTotal(res.total);
      setActiveId((cur) => cur ?? res.items[0]?.id ?? null);
    } catch (e) {
      setConversations([]);
      setListError(
        e instanceof ApiError
          ? `Could not load conversations (${e.status}).`
          : "Could not reach the API. Check that the backend is running on port 8000.",
      );
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadList();
  }, [loadList]);

  useEffect(() => {
    getMessageTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, []);

  useEffect(() => {
    if (!activeId) return;
    let ignore = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThreadLoading(true);
    getConversationThread(activeId)
      .then(async (t) => {
        if (ignore) return;
        setThread(t);
        if (t.candidate_slug) {
          try {
            const c = await getCandidate(t.candidate_slug);
            if (!ignore) setCandidate(c);
          } catch {
            if (!ignore) setCandidate(null);
          }
        }
      })
      .catch(() => {
        if (!ignore) setThread(null);
      })
      .finally(() => {
        if (!ignore) setThreadLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [activeId]);

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        (c.candidate_name ?? "").toLowerCase().includes(q) ||
        c.subject.toLowerCase().includes(q),
    );
  }, [conversations, search]);

  const threadMessages = useMemo(() => {
    const all = thread?.messages ?? [];
    if (tab === "Scheduled") return all.filter((m) => m.status === "scheduled");
    if (tab === "Sent")
      return all.filter(
        (m) => m.direction === "outbound" && m.status !== "scheduled",
      );
    return all.filter((m) => m.status !== "scheduled");
  }, [thread, tab]);

  const overview = useMemo(() => {
    const msgs = (thread?.messages ?? []).filter((m) => m.status !== "scheduled");
    const sent = msgs.filter((m) => m.direction === "outbound").length;
    const replies = msgs.filter((m) => m.direction === "inbound").length;

    // average time between an outbound message and the next inbound reply
    const ordered = [...msgs].sort(
      (a, b) =>
        new Date(a.sent_at ?? 0).getTime() - new Date(b.sent_at ?? 0).getTime(),
    );
    const gaps: number[] = [];
    for (let i = 1; i < ordered.length; i++) {
      if (
        ordered[i].direction === "inbound" &&
        ordered[i - 1].direction === "outbound" &&
        ordered[i].sent_at &&
        ordered[i - 1].sent_at
      ) {
        gaps.push(
          new Date(ordered[i].sent_at as string).getTime() -
            new Date(ordered[i - 1].sent_at as string).getTime(),
        );
      }
    }
    const avgMs = gaps.length
      ? gaps.reduce((a, b) => a + b, 0) / gaps.length
      : 0;
    const avgLabel = avgMs
      ? `${Math.floor(avgMs / 3600000)}h ${Math.round(
          (avgMs % 3600000) / 60000,
        )}m`
      : "n/a";
    const responseRate = sent ? Math.min(100, Math.round((replies / sent) * 100)) : 0;

    return [
      { label: "Messages Sent", value: String(sent), icon: EnvelopeIcon },
      { label: "Replies Received", value: String(replies), icon: ArrowUturnLeftIcon },
      { label: "Avg. Response Time", value: avgLabel, icon: ClockIcon },
      { responseRate },
    ] as const;
  }, [thread]);

  const responseRate = (overview[3] as { responseRate: number }).responseRate;

  const commScore = candidate?.engagement_score
    ? Math.min(5, candidate.engagement_score / 20).toFixed(1)
    : null;

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const showTemplates = tab === "Templates";

  return (
    <AppShell
      title="Communication"
      searchPlaceholder="Search candidates, messages, templates..."
    >
      <div className="mb-4 flex items-center justify-between">
        <nav className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-orange">Communication</span>
          <ChevronRightIcon className="h-3.5 w-3.5 text-text-secondary" />
          <span className="font-semibold text-charcoal">{tab}</span>
        </nav>
        <div className="flex gap-2">
          <button
            onClick={() => setTab("Templates")}
            className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-charcoal hover:bg-cream"
          >
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
        {TABS.map((t) => (
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

      {showTemplates ? (
        <Card>
          <h3 className="font-heading text-base font-semibold text-charcoal">
            Message Templates
          </h3>
          <p className="mt-1 text-sm text-text-secondary">
            Reusable messages for each stage of the engagement journey.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {templates.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-border p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-charcoal">{t.name}</p>
                  <Badge tone="peach">{CHANNEL_LABEL[t.channel] ?? t.channel}</Badge>
                </div>
                <p className="mt-2 line-clamp-3 text-xs text-text-secondary">
                  {t.body}
                </p>
                <p className="mt-3 text-[11px] text-text-secondary">
                  Used {t.usage_count} times, updated {formatDate(t.updated_at)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[320px_1fr_300px]">
          <Card className="flex flex-col p-0">
            <div className="border-b border-border p-4">
              <p className="font-heading text-base font-semibold text-charcoal">
                Conversations
              </p>
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-text-secondary">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or subject..."
                  className="w-full bg-transparent outline-none"
                />
                <FunnelIcon className="h-4 w-4" />
              </div>
            </div>

            <ul className="max-h-[560px] flex-1 overflow-y-auto">
              {listLoading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <li key={i} className="px-4 py-3">
                    <div className="h-10 w-full animate-pulse rounded bg-border" />
                  </li>
                ))}

              {!listLoading &&
                filteredConversations.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => setActiveId(c.id)}
                      className={
                        c.id === activeId
                          ? "flex w-full gap-3 border-l-2 border-orange bg-peach/30 px-4 py-3 text-left"
                          : "flex w-full gap-3 border-l-2 border-transparent px-4 py-3 text-left hover:bg-cream/60"
                      }
                    >
                      <Avatar
                        initials={c.candidate_initials ?? "?"}
                        size="md"
                        online={c.is_online}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="truncate text-sm font-semibold text-charcoal">
                            {c.candidate_name ?? "Unknown"}
                          </span>
                          <span className="ml-2 flex items-center gap-1 whitespace-nowrap text-[11px] text-text-secondary">
                            {c.unread_count > 0 && (
                              <span className="h-1.5 w-1.5 rounded-full bg-orange" />
                            )}
                            {relativeTime(c.last_message_at)}
                          </span>
                        </div>
                        <p className="truncate text-xs font-medium text-text-secondary">
                          {c.subject}
                        </p>
                        <p className="truncate text-xs text-text-secondary">
                          {c.last_message_preview}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}

              {!listLoading && !listError && filteredConversations.length === 0 && (
                <li className="px-4 py-10 text-center text-sm text-text-secondary">
                  No conversations match your search.
                </li>
              )}
              {listError && (
                <li className="px-4 py-10 text-center text-sm text-coral">
                  {listError}
                </li>
              )}
            </ul>

            <div className="border-t border-border px-4 py-3 text-xs text-text-secondary">
              Showing {filteredConversations.length} of {total} conversations
            </div>
          </Card>

          <Card className="flex flex-col p-0">
            {!active ? (
              <div className="flex flex-1 items-center justify-center p-10 text-sm text-text-secondary">
                Select a conversation
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-border p-4">
                  <div className="flex items-center gap-3">
                    <Avatar
                      initials={active.candidate_initials ?? "?"}
                      size="md"
                      online={active.is_online}
                    />
                    <div>
                      <p className="text-sm font-semibold text-charcoal">
                        {active.candidate_name}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {active.candidate_role}
                        {active.candidate_location_city
                          ? `, ${active.candidate_location_city}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  {active.candidate_slug && (
                    <Link
                      href={`/candidates/${active.candidate_slug}`}
                      className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-charcoal hover:bg-cream"
                    >
                      View Candidate
                    </Link>
                  )}
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto bg-cream/40 p-5">
                  {threadLoading && (
                    <p className="text-center text-sm text-text-secondary">
                      Loading messages...
                    </p>
                  )}
                  {!threadLoading && threadMessages.length === 0 && (
                    <p className="text-center text-sm text-text-secondary">
                      {tab === "Scheduled"
                        ? "No scheduled messages in this conversation."
                        : "No messages to show."}
                    </p>
                  )}
                  {!threadLoading &&
                    threadMessages.map((m, i) => {
                      const prev = threadMessages[i - 1];
                      const showDate =
                        i === 0 ||
                        formatDate(prev?.sent_at) !== formatDate(m.sent_at);
                      const hr = isHrMessage(m);
                      return (
                        <div key={m.id}>
                          {showDate && (
                            <p className="my-3 text-center text-xs font-medium text-text-secondary">
                              {formatDate(m.sent_at ?? m.scheduled_for)}
                            </p>
                          )}
                          <div
                            className={hr ? "flex justify-start" : "flex justify-end"}
                          >
                            <div
                              className={
                                hr
                                  ? "max-w-[75%] rounded-2xl rounded-tl-sm bg-peach/60 px-4 py-3 text-sm text-charcoal"
                                  : "max-w-[75%] rounded-2xl rounded-tr-sm bg-teal/15 px-4 py-3 text-sm text-charcoal"
                              }
                            >
                              <p className="mb-1 text-[11px] font-semibold text-text-secondary">
                                {m.sender_name}
                                {m.is_ai_generated ? " (AI drafted)" : ""}
                                {m.is_internal_note ? " (internal note)" : ""}
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
              </>
            )}
          </Card>

          <div className="space-y-4">
            <Card>
              <h3 className="font-heading text-base font-semibold text-charcoal">
                Engagement Overview
              </h3>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {overview.slice(0, 3).map((o) => {
                  const item = o as {
                    label: string;
                    value: string;
                    icon: typeof EnvelopeIcon;
                  };
                  return (
                    <div key={item.label} className="rounded-xl bg-cream/70 p-3">
                      <item.icon className="mx-auto h-4 w-4 text-orange" />
                      <p className="mt-1 font-heading text-lg font-bold text-charcoal">
                        {item.value}
                      </p>
                      <p className="text-[10px] leading-tight text-text-secondary">
                        {item.label}
                      </p>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-text-secondary">
                Response Rate ({responseRate}%)
              </p>
              <div className="mt-1 h-2 w-full rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-teal"
                  style={{ width: `${responseRate}%` }}
                />
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-base font-semibold text-charcoal">
                  Candidate Status
                </h3>
                {candidate && (
                  <Badge tone="teal">
                    {STATUS_LABEL[candidate.status] ?? candidate.status}
                  </Badge>
                )}
              </div>
              <dl className="mt-3 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-text-secondary">Current Stage</dt>
                  <dd className="font-semibold text-charcoal">
                    {candidate
                      ? (STAGE_LABEL[candidate.current_stage] ??
                        candidate.current_stage)
                      : "-"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-secondary">Last Interaction</dt>
                  <dd className="font-semibold text-charcoal">
                    {candidate
                      ? relativeDays(candidate.days_since_interaction)
                      : "-"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-secondary">Preferred Channel</dt>
                  <dd className="font-semibold text-charcoal">
                    {candidate?.last_interaction_channel
                      ? (CHANNEL_LABEL[candidate.last_interaction_channel] ??
                        candidate.last_interaction_channel)
                      : "-"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-secondary">Engagement Score</dt>
                  <dd className="font-semibold text-teal">
                    {commScore ? `${commScore}/5` : "-"}
                  </dd>
                </div>
              </dl>
            </Card>

            <Card>
              <h3 className="font-heading text-base font-semibold text-charcoal">
                Preferred Channels
              </h3>
              <ul className="mt-3 space-y-2.5 text-sm">
                {[
                  { key: "email", label: "Email", value: candidate?.email },
                  { key: "whatsapp", label: "WhatsApp", value: candidate?.phone },
                  { key: "sms", label: "SMS", value: candidate?.phone },
                ].map((ch) => {
                  const on = candidate?.last_interaction_channel === ch.key;
                  return (
                    <li key={ch.key} className="flex items-center gap-2">
                      <span
                        className={
                          on
                            ? "flex h-4 w-4 items-center justify-center rounded bg-orange text-white"
                            : "h-4 w-4 rounded border border-border"
                        }
                      >
                        {on && <CheckCircleIcon className="h-3 w-3" />}
                      </span>
                      <span className="font-medium text-charcoal">{ch.label}</span>
                      <span className="ml-auto truncate text-xs text-text-secondary">
                        {ch.value ?? "-"}
                      </span>
                    </li>
                  );
                })}
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
      )}

      {listError && !showTemplates && (
        <div className="mt-4 flex items-center gap-2 text-sm text-coral">
          <ExclamationTriangleIcon className="h-4 w-4" />
          {listError}
          <button
            onClick={loadList}
            className="font-semibold text-orange underline"
          >
            Retry
          </button>
        </div>
      )}
    </AppShell>
  );
}
