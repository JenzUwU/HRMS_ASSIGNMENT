"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BookmarkIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  FaceSmileIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  PlusIcon,
} from "@heroicons/react/24/solid";
import { AppShell } from "@/components/layout/AppShell";
import { AiInsightsCard } from "@/components/candidates/AiInsightsCard";
import { GlassIcon, type GlassIconName } from "@/components/ui/GlassIcon";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/cn";
import { cleanInboundEmailBody } from "@/lib/clean-inbound-email";
import { ApiError } from "@/lib/api-client";
import {
  aiDraftMessage,
  createCandidateMessage,
  createCandidateTask,
  getCandidate,
  getCandidateCommunications,
  getConversationThread,
  getConversations,
  getMessageTemplates,
  sendCandidateEmail,
  updateCandidate,
  type AiChannel,
  type CandidateDetail,
  type Conversation,
  type ConversationThread,
  type Message,
  type MessageTemplate,
} from "@/lib/api";
import { aiErrorMessage, mutationErrorMessage } from "@/lib/ai-error";
import { takeAiDraft } from "@/lib/ai-compose";
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

// Sentinel id for "this candidate has no email conversation yet". The composer
// still works: the backend opens the conversation on the first send.
const NEW_EMAIL_CONV = "__new_email_conversation__";

/** Build a placeholder email conversation for a candidate with no thread yet. */
function synthEmailConversation(c: CandidateDetail): Conversation {
  const now = new Date().toISOString();
  return {
    id: NEW_EMAIL_CONV,
    candidate_id: c.id,
    candidate_name: c.full_name,
    candidate_initials: c.initials,
    candidate_slug: c.slug,
    candidate_role: c.role,
    candidate_location_city: c.location_city,
    candidate_status: c.status,
    candidate_current_stage: c.current_stage,
    channel: "email",
    subject: "",
    last_message_at: null,
    last_message_preview: null,
    unread_count: 0,
    is_online: false,
    created_at: now,
    updated_at: now,
  };
}

/** Insert or replace a conversation by id; drop any stale placeholder. */
function upsertConversation(list: Conversation[], conv: Conversation): Conversation[] {
  const rest = list.filter(
    (c) => c.id !== conv.id && c.id !== NEW_EMAIL_CONV,
  );
  return [conv, ...rest];
}

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

  const [composerMode, setComposerMode] = useState<"message" | "note">(
    "message",
  );
  const [draft, setDraft] = useState("");
  const [subject, setSubject] = useState("");
  const [sending, setSending] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [aiRecId, setAiRecId] = useState<string | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null);
  const [preferredChannel, setPreferredChannel] = useState<string | null>(null);
  const [savingChannel, setSavingChannel] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await getConversations(1, 50);
      setConversations(res.items);
      setTotal(res.total);
      // Deep link: /communication?c=<conversationId> opens that thread directly.
      const wanted =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("c")
          : null;
      const preselect =
        wanted && res.items.some((i) => i.id === wanted)
          ? wanted
          : (res.items[0]?.id ?? null);
      setActiveId((cur) => cur ?? preselect);
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

  // Deep link support: /communication?candidate=<slug> opens THAT candidate's
  // email conversation, resolved from candidate-scoped endpoints so it works no
  // matter where the candidate sits in the paginated conversation list (or if
  // they have no conversation yet). ?compose=ai also loads the stashed AI draft.
  // The slug from ?compose=ai - the ONLY candidate whose stashed AI draft this
  // page will load. Never nulled by the list flow, so a race cannot orphan it.
  const aiComposeSlug = useRef<string | null>(null);
  const deepLinkSlug = useRef<string | null>(null);
  const [deepLinkPending, setDeepLinkPending] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("candidate");
    aiComposeSlug.current =
      params.get("compose") === "ai" ? slug : null;
    deepLinkSlug.current = slug;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDeepLinkPending(slug);
  }, []);

  useEffect(() => {
    const slug = deepLinkPending;
    if (!slug) return;
    let ignore = false;
    // deepLinkPending itself drives the loading UI - no sync setState here.
    Promise.all([getCandidate(slug), getCandidateCommunications(slug)])
      .then(([cand, comms]) => {
        if (ignore) return;
        const emailThread =
          comms.conversations.find((c) => c.channel === "email") ?? null;
        const conv: Conversation = emailThread ?? synthEmailConversation(cand);
        setCandidate(cand);
        setConversations((list) => upsertConversation(list, conv));
        setThread(
          emailThread ?? { ...synthEmailConversation(cand), messages: [] },
        );
        setActiveId(conv.id);
      })
      .catch((e) => {
        if (ignore) return;
        setListError(
          e instanceof ApiError && e.status === 404
            ? "That candidate could not be found."
            : "Could not load that candidate's conversation.",
        );
      })
      .finally(() => {
        if (!ignore) setDeepLinkPending(null);
      });
    return () => {
      ignore = true;
    };
  }, [deepLinkPending]);

  // Load the thread + candidate when a conversation is picked from the list.
  // Skipped for the deep-link path (handled above) and the "no thread yet"
  // placeholder (nothing to fetch).
  useEffect(() => {
    if (!activeId || activeId === NEW_EMAIL_CONV) return;
    // The deep-link resolver is mid-flight; it will set the correct thread.
    if (deepLinkPending) return;
    if (deepLinkSlug.current) {
      // The deep-link resolver owns the first selection for this slug; let it
      // finish, then clear so later list clicks load normally.
      const owned = conversations.find(
        (c) => c.id === activeId && c.candidate_slug === deepLinkSlug.current,
      );
      if (owned) {
        deepLinkSlug.current = null;
        return;
      }
    }
    let ignore = false;
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
  }, [activeId, conversations, deepLinkPending]);

  // Composer belongs to one candidate. When the selected candidate changes,
  // wipe the previous candidate's draft / subject / AI provenance so nothing
  // leaks across candidates, then load a stashed AI draft for the new one.
  const composerFor = useRef<string | null>(null);
  useEffect(() => {
    const slug = candidate?.slug;
    if (!slug || slug === composerFor.current) return;
    composerFor.current = slug;
    // Load the stashed AI draft only for the candidate it was generated for;
    // otherwise the composer starts empty for the new candidate.
    const stashed =
      aiComposeSlug.current === slug ? takeAiDraft(slug) : null;
    if (stashed) aiComposeSlug.current = null;
    setDraft(stashed?.body ?? "");
    setSubject(stashed?.subject ?? "");
    setAiRecId(null);
    setComposerError(null);
    setComposerMode("message");
    if (stashed) toast("AI draft loaded, review before sending", "success");
  }, [candidate?.slug]);

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

  async function refreshThread() {
    if (!activeId) return;
    // Placeholder thread: the real conversation was just created by the send.
    // Re-resolve it from the candidate so the id and messages become real.
    if (activeId === NEW_EMAIL_CONV) {
      if (!candidate) return;
      try {
        const comms = await getCandidateCommunications(candidate.slug);
        const emailThread =
          comms.conversations.find((c) => c.channel === "email") ?? null;
        if (emailThread) {
          setConversations((list) => upsertConversation(list, emailThread));
          setThread(emailThread);
          setActiveId(emailThread.id);
        }
      } catch {
        /* keep the placeholder on transient failure */
      }
      return;
    }
    try {
      setThread(await getConversationThread(activeId));
    } catch {
      /* keep current thread on transient failure */
    }
  }

  async function generateDraft() {
    const conv = conversations.find((c) => c.id === activeId) ?? null;
    if (!candidate || !conv || drafting) return;
    setDrafting(true);
    setComposerError(null);
    try {
      const res = await aiDraftMessage(candidate.slug, {
        channel: (conv.channel as AiChannel) ?? "email",
      });
      setDraft(res.result.body);
      if (res.result.subject) setSubject(res.result.subject);
      setAiRecId(res.meta.record_id);
      toast("AI draft ready: review before sending", "success");
    } catch (e) {
      setComposerError(aiErrorMessage(e));
    } finally {
      setDrafting(false);
    }
  }

  async function sendDraft() {
    const text = draft.trim();
    const conv = conversations.find((c) => c.id === activeId) ?? null;
    if (!text || !activeId || !conv || sending) return;
    const channel = conv.channel ?? "email";
    const isEmail = channel === "email";
    const asEmail = composerMode === "message" && isEmail;

    // WhatsApp / SMS have no connected provider yet. Never fake a sent message
    // on those channels - an internal note is still allowed.
    if (composerMode === "message" && (channel === "whatsapp" || channel === "sms")) {
      setComposerError(
        `${channel === "whatsapp" ? "WhatsApp" : "SMS"} is not connected yet. ` +
          "Use email, or add this as an internal note.",
      );
      return;
    }

    if (asEmail && !subject.trim()) {
      setComposerError("Add a subject before sending the email.");
      return;
    }

    // Recipient safety: send to the resolved candidate. If the loaded candidate
    // and the selected conversation disagree, refuse rather than risk emailing
    // the wrong person.
    if (
      candidate &&
      conv.candidate_slug &&
      candidate.slug !== conv.candidate_slug
    ) {
      setComposerError(
        "Candidate mismatch detected. Reload this page and try again.",
      );
      return;
    }
    const targetCandidateId = candidate?.id ?? conv.candidate_id;

    setSending(true);
    setComposerError(null);
    try {
      if (asEmail) {
        // REAL email through Gmail SMTP (server-side). The backend resolves the
        // recipient from this candidate id - never a client-supplied address.
        await sendCandidateEmail(targetCandidateId, {
          subject: subject.trim(),
          body: text,
          ai_recommendation_id: aiRecId,
        });
      } else {
        await createCandidateMessage(targetCandidateId, {
          channel: (conv.channel as AiChannel) ?? "email",
          body: text,
          is_internal_note: composerMode === "note",
        });
      }
      await refreshThread();
      setDraft("");
      setSubject("");
      setAiRecId(null);
      toast(
        composerMode === "note"
          ? "Internal note added"
          : asEmail
            ? "Email sent"
            : "Message sent",
        "success",
      );
    } catch (e) {
      // Keep composer contents; never append a fake message.
      setComposerError(
        mutationErrorMessage(
          e,
          composerMode === "note"
            ? "Could not save the note."
            : asEmail
              ? "Email could not be sent."
              : "Could not send the message.",
        ),
      );
    } finally {
      setSending(false);
    }
  }

  function copyTemplate(t: MessageTemplate) {
    navigator.clipboard
      ?.writeText(t.body)
      .then(() => {
        setCopiedTemplate(t.id);
        toast("Template copied", "success");
        window.setTimeout(() => setCopiedTemplate(null), 1800);
      })
      .catch(() => toast("Could not copy", "error"));
  }

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
      { label: "Messages Sent", value: String(sent), glassIcon: "email" as const },
      {
        label: "Replies Received",
        value: String(replies),
        glassIcon: "messages" as const,
      },
      {
        label: "Avg. Response Time",
        value: avgLabel,
        glassIcon: "attendance" as const,
      },
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
            type="button"
            onClick={() => setTab("Templates")}
            className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-charcoal transition-all duration-150 hover:-translate-y-px hover:border-orange/40 hover:bg-cream active:translate-y-0"
          >
            <GlassIcon name="documents" size={16} />
            Message Templates
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("Inbox");
              setComposerMode("message");
              toast("Pick a conversation, then type below to send");
            }}
            className="flex items-center gap-2 rounded-xl bg-orange px-4 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:bg-orange/90 active:translate-y-0"
          >
            <PlusIcon className="h-4 w-4" />
            New Message
          </button>
        </div>
      </div>

      <div className="mb-4 flex gap-5 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            aria-current={t === tab ? "page" : undefined}
            onClick={() => setTab(t)}
            className={cn(
              "-mb-px border-b-2 pb-3 text-sm font-semibold transition-colors duration-200",
              t === tab
                ? "border-orange text-orange"
                : "border-transparent text-text-secondary hover:border-orange/30 hover:text-charcoal",
            )}
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
                className="group flex flex-col rounded-xl border border-border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-orange/40 hover:shadow-[0_10px_24px_-12px_rgba(41,41,41,0.18)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-charcoal group-hover:text-orange">
                    {t.name}
                  </p>
                  <Badge tone="peach">
                    {CHANNEL_LABEL[t.channel] ?? t.channel}
                  </Badge>
                </div>
                <p className="mt-2 line-clamp-3 flex-1 whitespace-pre-wrap text-xs text-text-secondary">
                  {t.body}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-[11px] text-text-secondary">
                    Used {t.usage_count}× · {formatDate(t.updated_at)}
                  </p>
                  <button
                    type="button"
                    title="Copy template"
                    onClick={() => copyTemplate(t)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors",
                      copiedTemplate === t.id
                        ? "border-teal/40 bg-teal/10 text-teal"
                        : "border-border text-charcoal hover:border-orange/40 hover:bg-peach/40 hover:text-orange",
                    )}
                  >
                    {copiedTemplate === t.id ? (
                      <>
                        <CheckCircleIcon className="h-3.5 w-3.5" />
                        Copied
                      </>
                    ) : (
                      <>
                        <GlassIcon name="documents" size={14} />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 xl:h-[calc(100vh-12rem)] xl:min-h-[34rem] xl:grid-cols-[320px_1fr_300px]">
          <Card className="flex min-h-0 flex-col overflow-hidden p-0">
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
                <GlassIcon name="filters" size={16} />
              </div>
            </div>

            <ul className="max-h-[70vh] min-h-0 flex-1 overflow-y-auto xl:max-h-none">
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
                      type="button"
                      onClick={() => setActiveId(c.id)}
                      className={cn(
                        "group/row flex w-full cursor-pointer gap-3 border-l-2 px-4 py-3 text-left transition-colors duration-150",
                        c.id === activeId
                          ? "border-orange bg-peach/30"
                          : "border-transparent hover:bg-peach/15",
                      )}
                    >
                      <Avatar
                        initials={c.candidate_initials ?? "?"}
                        size="md"
                        online={c.is_online}
                        className="transition-transform duration-150 group-hover/row:-translate-y-px"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span
                            className={cn(
                              "truncate text-sm font-semibold transition-colors",
                              c.id === activeId
                                ? "text-orange"
                                : "text-charcoal group-hover/row:text-orange",
                            )}
                          >
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

          <Card className="flex min-h-0 flex-col overflow-hidden p-0">
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
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={refreshThread}
                      title="Check for new replies"
                      className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-charcoal transition-all duration-150 hover:-translate-y-px hover:border-orange/40 hover:bg-cream hover:text-orange active:translate-y-0"
                    >
                      Refresh
                    </button>
                    {active.candidate_slug && (
                      <Link
                        href={`/candidates/${active.candidate_slug}`}
                        className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-charcoal transition-all duration-150 hover:-translate-y-px hover:border-orange/40 hover:bg-cream hover:text-orange active:translate-y-0"
                      >
                        View Candidate
                      </Link>
                    )}
                  </div>
                </div>

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-cream/40 p-5">
                  {(threadLoading || deepLinkPending) && (
                    <p className="text-center text-sm text-text-secondary">
                      Loading messages...
                    </p>
                  )}
                  {!threadLoading &&
                    !deepLinkPending &&
                    threadMessages.length === 0 && (
                      <p className="text-center text-sm text-text-secondary">
                        {tab === "Scheduled"
                          ? "No scheduled messages in this conversation."
                          : "No messages to show."}
                      </p>
                    )}
                  {!threadLoading &&
                    !deepLinkPending &&
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
                              <p className="mb-1 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-text-secondary">
                                <span>{m.sender_name}</span>
                                <Badge
                                  tone={hr ? "peach" : "teal"}
                                >
                                  {m.direction === "inbound"
                                    ? "Inbound"
                                    : "Outbound"}
                                </Badge>
                                <span className="uppercase">{m.channel}</span>
                                {m.is_ai_generated ? "· AI drafted" : ""}
                                {m.is_internal_note ? "· internal note" : ""}
                              </p>
                              {m.subject && (
                                <p className="mb-1 text-xs font-semibold text-charcoal">
                                  {m.subject}
                                </p>
                              )}
                              <p className="whitespace-pre-wrap">
                                {m.direction === "inbound" &&
                                m.channel === "email"
                                  ? cleanInboundEmailBody(m.body)
                                  : m.body}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>

                <div className="border-t border-border p-4">
                  <div className="mb-2 flex gap-2 text-sm">
                    {(["message", "note"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setComposerMode(m)}
                        className={cn(
                          "rounded-lg px-2.5 py-1 font-semibold transition-colors",
                          composerMode === m
                            ? "bg-peach/50 text-orange"
                            : "text-text-secondary hover:text-charcoal",
                        )}
                      >
                        {m === "message" ? "Message" : "Note (Internal)"}
                      </button>
                    ))}
                  </div>
                  <div
                    className={cn(
                      "rounded-xl border p-3 transition-colors",
                      composerMode === "note"
                        ? "border-warning/40 bg-warning/5"
                        : "border-border focus-within:border-orange/50",
                    )}
                  >
                    {composerMode === "message" &&
                      (active?.channel ?? "email") === "email" && (
                        <div className="mb-2 flex items-center gap-2">
                          <input
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Subject"
                            className="w-full border-b border-border bg-transparent pb-1 text-sm font-semibold text-charcoal outline-none placeholder:font-normal placeholder:text-text-secondary"
                          />
                          <button
                            type="button"
                            onClick={generateDraft}
                            disabled={drafting || !candidate}
                            className="flex shrink-0 items-center gap-1 rounded-lg border border-orange/40 px-2 py-1 text-xs font-semibold text-orange transition-colors hover:bg-peach/40 disabled:opacity-50"
                          >
                            {drafting ? "Drafting…" : "AI draft"}
                          </button>
                        </div>
                      )}
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                          sendDraft();
                      }}
                      rows={composerMode === "message" ? 3 : 2}
                      placeholder={
                        composerMode === "note"
                          ? "Add an internal note (not sent to the candidate)…"
                          : "Write the email… (⌘/Ctrl+Enter to send)"
                      }
                      className="w-full resize-none bg-transparent text-sm text-charcoal outline-none placeholder:text-text-secondary"
                    />
                    {aiRecId && composerMode === "message" && (
                      <p className="text-[11px] text-text-secondary">
                        AI draft: review and edit before sending.
                      </p>
                    )}
                    {composerError && (
                      <p className="mt-2 text-xs font-medium text-coral">
                        {composerError}
                      </p>
                    )}
                    <div className="mt-3 flex items-center justify-between text-text-secondary">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title="Attach a file"
                          onClick={() =>
                            toast("Attachments aren't supported in the prototype")
                          }
                          className="rounded-lg p-1.5 transition-colors hover:bg-peach/40 hover:text-orange"
                        >
                          <PaperClipIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Insert a template"
                          onClick={() => setTab("Templates")}
                          className="rounded-lg p-1.5 transition-colors hover:bg-peach/40 hover:text-orange"
                        >
                          <GlassIcon name="documents" size={16} />
                        </button>
                        <button
                          type="button"
                          title="Emoji"
                          onClick={() => setDraft((d) => `${d} 🙂`)}
                          className="rounded-lg p-1.5 transition-colors hover:bg-peach/40 hover:text-orange"
                        >
                          <FaceSmileIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Save as quick reply"
                          onClick={() => toast("Saved as a quick reply")}
                          className="rounded-lg p-1.5 transition-colors hover:bg-peach/40 hover:text-orange"
                        >
                          <BookmarkIcon className="h-4 w-4" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={sendDraft}
                        disabled={!draft.trim() || sending}
                        className="flex items-center gap-2 rounded-lg bg-orange px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:bg-orange/90 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                      >
                        {sending ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-transparent" />
                        ) : (
                          <PaperAirplaneIcon className="h-4 w-4" />
                        )}
                        {sending
                          ? "Sending…"
                          : composerMode === "note"
                            ? "Add Note"
                            : (active?.channel ?? "email") === "email"
                              ? "Send Email"
                              : "Send"}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </Card>

          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto xl:pr-1">
            {candidate && <AiInsightsCard key={candidate.slug} slug={candidate.slug} />}
            <Card>
              <h3 className="font-heading text-base font-semibold text-charcoal">
                Engagement Overview
              </h3>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {overview.slice(0, 3).map((o) => {
                  const item = o as {
                    label: string;
                    value: string;
                    glassIcon: GlassIconName;
                  };
                  return (
                    <div
                      key={item.label}
                      title={item.label}
                      className="group rounded-xl bg-cream/70 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:bg-peach/40 hover:shadow-[0_8px_18px_-10px_rgba(41,41,41,0.2)]"
                    >
                      <GlassIcon
                        name={item.glassIcon}
                        size={22}
                        className="mx-auto transition-transform duration-200 group-hover:scale-110"
                      />
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
                  const on =
                    preferredChannel === ch.key ||
                    (preferredChannel === null &&
                      candidate?.last_interaction_channel === ch.key);
                  return (
                    <li key={ch.key}>
                      <button
                        type="button"
                        disabled={savingChannel || !candidate}
                        onClick={async () => {
                          if (!candidate) return;
                          const prev = preferredChannel;
                          setPreferredChannel(ch.key);
                          setSavingChannel(true);
                          try {
                            await updateCandidate(candidate.slug, {
                              preferred_channel: ch.key as AiChannel,
                            });
                            toast(
                              `Preferred channel set to ${ch.label}`,
                              "success",
                            );
                          } catch (e) {
                            setPreferredChannel(prev);
                            toast(
                              mutationErrorMessage(
                                e,
                                "Could not update the preferred channel.",
                              ),
                              "error",
                            );
                          } finally {
                            setSavingChannel(false);
                          }
                        }}
                        className="group flex w-full items-center gap-2 rounded-lg px-1 py-1 transition-colors hover:bg-peach/30 disabled:opacity-60"
                      >
                        <span
                          className={cn(
                            "flex h-4 w-4 items-center justify-center rounded transition-colors",
                            on
                              ? "bg-orange text-white"
                              : "border border-border group-hover:border-orange/50",
                          )}
                        >
                          {on && <CheckCircleIcon className="h-3 w-3" />}
                        </span>
                        <span className="font-medium text-charcoal">
                          {ch.label}
                        </span>
                        <span className="ml-auto truncate text-xs text-text-secondary">
                          {ch.value ?? "-"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>

            <Card>
              <h3 className="font-heading text-base font-semibold text-charcoal">
                Quick Actions
              </h3>
              <p className="mt-1 text-xs text-text-secondary">
                Creates a real follow-up task for this candidate.
              </p>
              <div className="mt-3 space-y-2">
                {(
                  [
                    {
                      label: "Send Document Reminder",
                      icon: "documents" as const,
                      title: "Send document reminder",
                      detail:
                        "Follow up with the candidate on their pending documents.",
                      done: "Document reminder task created",
                    },
                    {
                      label: "Schedule Check-in",
                      icon: "leave" as const,
                      title: "Schedule pre-joining check-in",
                      detail: "Set up a check-in call before the joining date.",
                      done: "Check-in task created",
                    },
                    {
                      label: "Share Pre-Joining Resources",
                      icon: "employees" as const,
                      title: "Share pre-joining resources",
                      detail:
                        "Send onboarding resources and the first-week plan.",
                      done: "Resource-sharing task created",
                    },
                  ] as const
                ).map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    disabled={!candidate || busyAction === a.label}
                    onClick={async () => {
                      if (!candidate) return;
                      setBusyAction(a.label);
                      try {
                        await createCandidateTask(candidate.slug, {
                          title: a.title,
                          detail: a.detail,
                          priority: "medium",
                        });
                        toast(
                          `${a.done} for ${candidate.full_name}`,
                          "success",
                        );
                      } catch (e) {
                        toast(
                          mutationErrorMessage(
                            e,
                            "Could not create the task.",
                          ),
                          "error",
                        );
                      } finally {
                        setBusyAction(null);
                      }
                    }}
                    className="group flex w-full items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold text-charcoal transition-all duration-150 hover:-translate-y-px hover:border-orange/40 hover:bg-cream hover:text-orange active:translate-y-0 disabled:opacity-60"
                  >
                    <GlassIcon
                      name={a.icon}
                      size={16}
                      className="transition-transform duration-200 group-hover:-translate-y-0.5"
                    />
                    {busyAction === a.label ? "Creating…" : a.label}
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
