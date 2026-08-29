"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/solid";
import { AppShell } from "@/components/layout/AppShell";
import { GlassIcon } from "@/components/ui/GlassIcon";
import { Card, SectionCard } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { useCountUp } from "@/lib/use-count-up";
import { toast } from "@/lib/toast";
import { mutationErrorMessage } from "@/lib/ai-error";
import { updateJourneyStep, type JourneyStepStatus } from "@/lib/api";
import { exportJourneyPdf } from "@/lib/export-journey";
import { cn } from "@/lib/cn";
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
  engagement: initialEngagement,
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
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Journey Timeline");
  const [engagement, setEngagement] = useState(initialEngagement);
  const [savingStage, setSavingStage] = useState<string | null>(null);

  async function setStepStatus(stage: string, status: JourneyStepStatus) {
    if (savingStage) return;
    setSavingStage(stage);
    try {
      const fresh = await updateJourneyStep(candidate.slug, stage, status);
      setEngagement(fresh);
      toast("Journey step updated", "success");
      router.refresh();
    } catch (e) {
      toast(mutationErrorMessage(e, "Could not update the step."), "error");
    } finally {
      setSavingStage(null);
    }
  }

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
  const animatedScore = useCountUp(score);
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
        <button
          type="button"
          onClick={() => {
            const ok = exportJourneyPdf({
              candidateName: candidate.full_name,
              role: candidate.role,
              recruiter: candidate.recruiter_name,
              riskLevel: `${riskLabel(riskLevelRaw)} Risk`,
              engagementScore: score,
              status: STATUS_LABEL[candidate.status] ?? candidate.status,
              stages: steps.map((s) => ({
                label: s.label,
                status: s.statusLabel ?? s.status,
                date: s.date,
              })),
              timeline: engagement.timeline.map((e) => ({
                when: formatDateTime(e.occurred_at),
                title: e.title,
                detail: e.description ?? "",
                actor: ACTOR_TAG[e.actor] ?? e.actor,
              })),
              communications: messages.map((m) => ({
                when: formatDate(m.sent_at),
                channel: m.channel,
                subject: m.subject ?? m.body.slice(0, 60),
              })),
              tasks: tasks.map((t) => ({
                title: t.title,
                status: t.status,
                due: t.due_date ? formatDate(t.due_date) : "",
              })),
              notes: notes.map((n) => ({
                author: n.author_name ?? "HR",
                when: formatDate(n.created_at),
                body: n.body,
              })),
              documents: documents.map((x) => ({
                name: DOC_TYPE_LABEL[x.doc_type] ?? x.doc_type,
                status: DOC_STATUS_LABEL[x.status] ?? x.status,
              })),
            });
            toast(
              ok
                ? "Journey ready: save it as PDF from the print dialog"
                : "Allow pop-ups to export the journey",
              ok ? "success" : "error",
            );
          }}
          className="group flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-charcoal transition-all duration-200 hover:-translate-y-px hover:border-orange/40 hover:bg-cream hover:shadow-[0_8px_20px_-10px_rgba(252,128,25,0.3)] active:translate-y-0"
        >
          <GlassIcon
            name="upload"
            size={16}
            className="transition-transform duration-200 group-hover:-translate-y-0.5"
          />
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
                <a
                  href={`mailto:${candidate.email}`}
                  title="Send email"
                  className="group flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:bg-peach/40 hover:text-orange"
                >
                  <GlassIcon
                    name="email"
                    size={18}
                    className="transition-transform duration-200 group-hover:-translate-y-0.5"
                  />
                  <span className="group-hover:underline">
                    {candidate.email}
                  </span>
                </a>
                {candidate.phone && (
                  <button
                    type="button"
                    title="Copy phone number"
                    onClick={() => {
                      navigator.clipboard
                        ?.writeText(candidate.phone as string)
                        .then(() => toast("Phone number copied", "success"))
                        .catch(() => toast("Could not copy", "error"));
                    }}
                    className="flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:bg-peach/40 hover:text-orange"
                  >
                    <GlassIcon name="messages" size={16} />
                    {candidate.phone}
                  </button>
                )}
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
              <Badge
                tone={riskTone}
                dot
                title={
                  riskLevelRaw === "high"
                    ? "High risk: reach out now to avoid drop-off"
                    : riskLevelRaw === "medium"
                      ? "Medium risk: keep engagement steady"
                      : "Low risk: engagement looks healthy"
                }
                className={cn(
                  "cursor-help transition-shadow duration-200",
                  riskLevelRaw === "high"
                    ? "risk-pulse hover:shadow-[0_0_0_5px_rgba(232,93,74,0.18)]"
                    : "hover:shadow-[0_0_0_4px_rgba(41,41,41,0.06)]",
                )}
              >
                {riskLabel(riskLevelRaw)} Risk
              </Badge>
            </div>
            <div className="text-center">
              <p className="text-xs text-text-secondary">Engagement Score</p>
              <p className="font-heading text-2xl font-bold text-charcoal">
                {animatedScore}/100
              </p>
              <RiskGauge score={score} />
            </div>
          </div>
        </div>
      </Card>

      <Card className="mb-4">
        <JourneyStepper steps={steps} />
        <div className="mt-5 border-t border-border pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Update Journey Progress
          </p>
          <div className="flex flex-wrap gap-2">
            {engagement.steps.map((s) => (
              <div
                key={s.stage}
                className="flex items-center gap-2 rounded-xl border border-border px-3 py-2"
              >
                <span className="text-sm font-medium text-charcoal">
                  {s.label}
                </span>
                <select
                  value={s.status}
                  disabled={savingStage === s.stage}
                  onChange={(e) =>
                    setStepStatus(
                      s.stage,
                      e.target.value as JourneyStepStatus,
                    )
                  }
                  className="rounded-lg border border-border bg-white/70 px-2 py-1 text-xs font-semibold text-charcoal outline-none focus:border-orange disabled:opacity-50"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="skipped">Skipped</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="p-0 xl:col-span-2">
          <div className="flex gap-4 overflow-x-auto border-b border-border px-5">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                aria-current={t === tab ? "page" : undefined}
                onClick={() => setTab(t)}
                className={cn(
                  "-mb-px border-b-2 py-3 text-sm font-semibold transition-colors duration-200",
                  t === tab
                    ? "border-orange text-orange"
                    : "border-transparent text-text-secondary hover:border-orange/30 hover:text-charcoal",
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <div key={tab} className="animate-fade-slide p-5">
            {tab === "Journey Timeline" && (
              <>
                {engagement.timeline.length === 0 ? (
                  <Empty text="No activity recorded yet." />
                ) : (
                  <ol className="relative space-y-6 border-l-2 border-border pl-6">
                    {engagement.timeline.map((e) => (
                      <li
                        key={e.id}
                        className="group/ev relative -mx-2 rounded-lg px-2 py-1 transition-colors hover:bg-peach/30"
                      >
                        <span className="absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full bg-teal text-white transition-transform duration-200 group-hover/ev:scale-110">
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
                        <GlassIcon
                          name={m.channel === "email" ? "email" : "messages"}
                          size={30}
                          className="mt-0.5"
                        />
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
                              <GlassIcon name="leave" size={14} />
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
                          <GlassIcon name="documents" size={16} />
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
              className="group mt-4 flex items-center justify-center gap-2 rounded-xl bg-cream/70 py-3 text-sm font-semibold text-orange transition-colors hover:bg-peach/60 active:bg-peach/70"
            >
              <ArrowLeftIcon className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
              Back to Candidate Details
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
                        <GlassIcon name="leave" size={14} />
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
                      <GlassIcon name="documents" size={16} />
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
            <div className="mt-4 flex items-center gap-5">
              <ProgressDonut
                percent={engagement.progress.percent_complete}
                label="Complete"
              />
              <dl className="grid flex-1 grid-cols-2 gap-x-3 gap-y-3">
                {[
                  {
                    dot: "bg-teal",
                    label: "Completed",
                    value: engagement.progress.completed,
                  },
                  {
                    dot: "bg-orange",
                    label: "In Progress",
                    value: engagement.progress.in_progress,
                  },
                  {
                    dot: "bg-border",
                    label: "Pending",
                    value: engagement.progress.pending,
                  },
                  {
                    dot: "bg-charcoal/30",
                    label: "Total Steps",
                    value: engagement.progress.total_steps,
                  },
                ].map((s) => (
                  <div key={s.label}>
                    <dd className="font-heading text-lg font-bold text-charcoal">
                      {s.value}
                    </dd>
                    <dt className="flex items-center gap-1.5 text-[11px] text-text-secondary">
                      <span className={cn("h-2 w-2 rounded-full", s.dot)} />
                      {s.label}
                    </dt>
                  </div>
                ))}
              </dl>
            </div>
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
