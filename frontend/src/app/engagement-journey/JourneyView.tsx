"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  ArrowUpTrayIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/solid";
import { AppShell } from "@/components/layout/AppShell";
import { Card, SectionCard } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { RiskGauge } from "@/components/charts/RiskGauge";
import { JourneyStepper } from "@/components/charts/JourneyStepper";
import { ProgressDonut } from "@/components/charts/ProgressDonut";
import type {
  CandidateCommunications,
  CandidateDetail,
  CandidateDocument,
  CandidateNote,
  CandidateTask,
  EngagementJourney,
} from "@/lib/api";
import {
  DOC_STATUS_LABEL,
  DOC_TYPE_LABEL,
  STATUS_LABEL,
  formatDate,
  formatDateTime,
  riskLabel,
} from "@/lib/format";

const TABS = [
  "Journey Timeline",
  "Communications",
  "Tasks",
  "Notes",
  "Documents",
] as const;
type Tab = (typeof TABS)[number];

const STEP_STATUS_LABEL: Record<string, string> = {
  completed: "Completed",
  in_progress: "In Progress",
  pending: "Pending",
  skipped: "Skipped",
};

const ACTOR_TAG: Record<string, string> = {
  candidate: "By Candidate",
  hr: "Action by HR",
  system: "System",
};

const TASK_TONE: Record<string, "teal" | "amber" | "neutral" | "coral"> = {
  done: "teal",
  in_progress: "amber",
  open: "neutral",
  dismissed: "neutral",
};

const DOC_TONE: Record<string, "teal" | "amber" | "coral" | "neutral"> = {
  verified: "teal",
  submitted: "amber",
  pending: "neutral",
  rejected: "coral",
};

export function JourneyView({
  candidate,
  engagement,
  communications,
  tasks,
  notes,
  documents,
}: {
  candidate: CandidateDetail;
  engagement: EngagementJourney;
  communications: CandidateCommunications;
  tasks: CandidateTask[];
  notes: CandidateNote[];
  documents: CandidateDocument[];
}) {
  const [tab, setTab] = useState<Tab>("Journey Timeline");

  const steps = engagement.steps.map((s) => ({
    label: s.label,
    date: s.completed_at
      ? formatDate(s.completed_at)
      : s.due_date
        ? `Due ${formatDate(s.due_date)}`
        : "",
    status: s.status as "completed" | "in_progress" | "pending",
    statusLabel: STEP_STATUS_LABEL[s.status] ?? s.status,
  }));

  const messages = communications.conversations
    .flatMap((c) => c.messages)
    .filter((m) => m.sent_at)
    .sort(
      (a, b) =>
        new Date(b.sent_at as string).getTime() -
        new Date(a.sent_at as string).getTime(),
    );

  const score = candidate.engagement_score ?? engagement.risk?.score ?? 0;
  const riskLevelRaw = engagement.risk?.level ?? candidate.risk_level;
  const riskTone =
    riskLevelRaw === "high" ? "coral" : riskLevelRaw === "medium" ? "amber" : "teal";

  return (
    <AppShell title="Engagement Journey">
      <div className="mb-5 flex items-center justify-between">
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/candidates" className="font-semibold text-orange">
            Candidates
          </Link>
          <ChevronRightIcon className="h-3.5 w-3.5 text-text-secondary" />
          <Link
            href={`/candidates/${candidate.slug}`}
            className="font-semibold text-orange"
          >
            {candidate.full_name}
          </Link>
          <ChevronRightIcon className="h-3.5 w-3.5 text-text-secondary" />
          <span className="font-semibold text-charcoal">Engagement Journey</span>
        </nav>
        <button className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-charcoal hover:bg-cream">
          <ArrowUpTrayIcon className="h-4 w-4" />
          Export Journey
        </button>
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-4">
            <Avatar initials={candidate.initials} size="lg" tone="peach" online />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-xl font-bold text-charcoal">
                  {candidate.full_name}
                </h2>
                <Badge tone="peach">
                  {STATUS_LABEL[candidate.status] ?? candidate.status}
                </Badge>
              </div>
              <p className="text-sm text-text-secondary">
                {candidate.role}, {candidate.location_city ?? candidate.location}
              </p>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-text-secondary">
                <span className="flex items-center gap-1">
                  <EnvelopeIcon className="h-3.5 w-3.5" />
                  {candidate.email}
                </span>
                {candidate.phone && <span>{candidate.phone}</span>}
              </div>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap gap-8 text-sm">
            <div>
              <p className="text-xs text-text-secondary">Recruiter</p>
              <p className="flex items-center gap-2 font-semibold text-charcoal">
                <Avatar initials={candidate.recruiter_initials} size="sm" />
                {candidate.recruiter_name}
              </p>
              <p className="mt-2 text-xs text-text-secondary">Source</p>
              <p className="font-semibold capitalize text-charcoal">
                {candidate.source}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Risk Level</p>
              <Badge tone={riskTone} dot>
                {riskLabel(riskLevelRaw)} Risk
              </Badge>
            </div>
            <div className="text-center">
              <p className="text-xs text-text-secondary">Engagement Score</p>
              <p className="font-heading text-2xl font-bold text-charcoal">
                {score}/100
              </p>
              <RiskGauge score={score} />
            </div>
          </div>
        </div>
      </Card>

      <Card className="mb-4">
        <JourneyStepper steps={steps} />
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="p-0 xl:col-span-2">
          <div className="flex gap-4 overflow-x-auto border-b border-border px-5">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={
                  t === tab
                    ? "border-b-2 border-orange py-3 text-sm font-semibold text-orange"
                    : "border-b-2 border-transparent py-3 text-sm font-semibold text-text-secondary hover:text-charcoal"
                }
              >
                {t}
              </button>
            ))}
          </div>

          <div className="p-5">
            {tab === "Journey Timeline" && (
              <>
                {engagement.timeline.length === 0 ? (
                  <Empty text="No activity recorded yet." />
                ) : (
                  <ol className="relative space-y-6 border-l-2 border-border pl-6">
                    {engagement.timeline.map((e) => (
                      <li key={e.id} className="relative">
                        <span className="absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full bg-teal text-white">
                          <CheckCircleIcon className="h-4 w-4" />
                        </span>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-medium text-text-secondary">
                              {formatDateTime(e.occurred_at)}
                            </p>
                            <p className="text-sm font-semibold text-charcoal">
                              {e.title}
                            </p>
                            {e.description && (
                              <p className="text-sm text-text-secondary">
                                {e.description}
                              </p>
                            )}
                          </div>
                          <Badge tone={e.actor === "candidate" ? "teal" : "peach"}>
                            {ACTOR_TAG[e.actor] ?? e.actor}
                          </Badge>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}

            {tab === "Communications" && (
              <>
                {messages.length === 0 ? (
                  <Empty text="No messages yet." />
                ) : (
                  <ul className="space-y-4">
                    {messages.map((m) => (
                      <li key={m.id} className="flex gap-3">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-peach text-orange">
                          {m.channel === "email" ? (
                            <EnvelopeIcon className="h-4 w-4" />
                          ) : (
                            <ChatBubbleLeftRightIcon className="h-4 w-4" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-charcoal">
                            {m.subject ?? m.body.slice(0, 60)}
                          </p>
                          <p className="text-xs text-text-secondary">
                            {m.direction === "outbound" ? "Sent" : "Received"} via{" "}
                            {m.channel}
                            {m.is_internal_note ? " (internal note)" : ""}
                            {m.is_ai_generated ? " (AI drafted)" : ""}
                          </p>
                        </div>
                        <span className="whitespace-nowrap text-xs text-text-secondary">
                          {formatDate(m.sent_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {tab === "Tasks" && (
              <>
                {tasks.length === 0 ? (
                  <Empty text="No tasks for this candidate." />
                ) : (
                  <ul className="space-y-3">
                    {tasks.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-charcoal">
                            {t.title}
                          </p>
                          {t.detail && (
                            <p className="text-xs text-text-secondary">
                              {t.detail}
                            </p>
                          )}
                          {t.due_date && (
                            <p className="mt-1 flex items-center gap-1 text-xs text-text-secondary">
                              <CalendarDaysIcon className="h-3.5 w-3.5" />
                              Due {formatDate(t.due_date)}
                            </p>
                          )}
                        </div>
                        <Badge tone={TASK_TONE[t.status] ?? "neutral"}>
                          {t.status.replace("_", " ")}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {tab === "Notes" && (
              <>
                {notes.length === 0 ? (
                  <Empty text="No notes for this candidate." />
                ) : (
                  <ul className="space-y-3">
                    {notes.map((n) => (
                      <li
                        key={n.id}
                        className="rounded-xl bg-cream/70 p-4 text-sm text-text-secondary"
                      >
                        <p>{n.body}</p>
                        <p className="mt-2 text-xs font-medium text-charcoal">
                          {n.author_name ?? "HR"}, {formatDate(n.created_at)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {tab === "Documents" && (
              <>
                {documents.length === 0 ? (
                  <Empty text="No documents requested." />
                ) : (
                  <ul className="space-y-3">
                    {documents.map((d) => (
                      <li
                        key={d.id}
                        className="flex items-center justify-between"
                      >
                        <span className="flex items-center gap-2 text-sm text-charcoal">
                          <DocumentTextIcon className="h-4 w-4 text-text-secondary" />
                          {DOC_TYPE_LABEL[d.doc_type] ?? d.doc_type}
                        </span>
                        <Badge tone={DOC_TONE[d.status] ?? "neutral"}>
                          {DOC_STATUS_LABEL[d.status] ?? d.status}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            <Link
              href={`/candidates/${candidate.slug}`}
              className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-cream/70 py-3 text-sm font-semibold text-orange"
            >
              Back to Candidate Details
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </Card>

        <div className="space-y-4">
          <SectionCard
            title="Upcoming / Pending Actions"
            action="View All"
            actionHref={`/candidates/${candidate.slug}`}
          >
            {engagement.upcoming_tasks.length === 0 ? (
              <Empty text="No pending actions." />
            ) : (
              <ul className="space-y-4">
                {engagement.upcoming_tasks.map((a) => (
                  <li key={a.id} className="flex items-start gap-3">
                    <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-border" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-charcoal">
                        {a.title}
                      </p>
                      {a.detail && (
                        <p className="text-xs text-text-secondary">{a.detail}</p>
                      )}
                    </div>
                    {a.due_date && (
                      <span className="flex items-center gap-1 whitespace-nowrap text-xs text-text-secondary">
                        <CalendarDaysIcon className="h-3.5 w-3.5" />
                        {formatDate(a.due_date)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Pending Documents"
            action="View All"
            actionHref={`/candidates/${candidate.slug}`}
          >
            {engagement.pending_documents.length === 0 ? (
              <Empty text="All documents are in order." />
            ) : (
              <ul className="space-y-3">
                {engagement.pending_documents.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2 text-sm text-charcoal">
                      <DocumentTextIcon className="h-4 w-4 text-text-secondary" />
                      {DOC_TYPE_LABEL[d.doc_type] ?? d.doc_type}
                    </span>
                    <Badge tone={DOC_TONE[d.status] ?? "neutral"}>
                      {DOC_STATUS_LABEL[d.status] ?? d.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <Card>
            <h3 className="font-heading text-base font-semibold text-charcoal">
              Engagement Risk
            </h3>
            <div className="mt-2">
              <Badge tone={riskTone} dot>
                {riskLabel(riskLevelRaw)} Risk
              </Badge>
            </div>
            <p className="mt-3 text-sm font-semibold text-charcoal">
              Risk Factors
            </p>
            {engagement.risk && engagement.risk.factors.length > 0 ? (
              <ul className="mt-2 space-y-1.5 text-sm text-text-secondary">
                {engagement.risk.factors.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-coral" />
                    {f}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-text-secondary">
                No active risk factors.
              </p>
            )}
            {engagement.risk?.summary && (
              <p className="mt-3 text-sm text-text-secondary">
                {engagement.risk.summary}
              </p>
            )}
          </Card>

          <Card>
            <h3 className="font-heading text-base font-semibold text-charcoal">
              Journey Progress
            </h3>
            <div className="mt-3 flex items-center gap-5">
              <ProgressDonut percent={engagement.progress.percent_complete} />
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2 text-text-secondary">
                  <span className="h-2.5 w-2.5 rounded-full bg-teal" /> Completed{" "}
                  {engagement.progress.completed}
                </li>
                <li className="flex items-center gap-2 text-text-secondary">
                  <span className="h-2.5 w-2.5 rounded-full bg-orange" /> In Progress{" "}
                  {engagement.progress.in_progress}
                </li>
                <li className="flex items-center gap-2 text-text-secondary">
                  <span className="h-2.5 w-2.5 rounded-full bg-border" /> Pending{" "}
                  {engagement.progress.pending}
                </li>
              </ul>
            </div>
            <p className="mt-3 text-xs text-text-secondary">
              Total Steps {engagement.progress.total_steps}
            </p>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="py-6 text-center text-sm text-text-secondary">{text}</p>
  );
}
