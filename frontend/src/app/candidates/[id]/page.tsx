import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronRightIcon,
  InformationCircleIcon,
  MapPinIcon,
} from "@heroicons/react/24/solid";
import { GlassIcon, type GlassIconName } from "@/components/ui/GlassIcon";
import { AppShell } from "@/components/layout/AppShell";
import { Card, SectionCard } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { RiskGauge } from "@/components/charts/RiskGauge";
import { JourneyStepper } from "@/components/charts/JourneyStepper";
import { CandidateAiPanel } from "@/components/candidates/CandidateAiPanel";
import { HrNotesCard } from "@/components/candidates/HrNotesCard";
import { RiskOverrideControl } from "@/components/candidates/RiskOverrideControl";
import { CandidateMoreActions } from "@/components/candidates/CandidateMoreActions";
import { ApiError } from "@/lib/api-client";
import {
  getCandidate,
  getCandidateCommunications,
  getEngagement,
  type Message,
} from "@/lib/api";
import {
  STATUS_LABEL,
  formatDate,
  relativeDays,
  relativeTime,
  riskLabel,
} from "@/lib/format";

const STEP_STATUS_LABEL: Record<string, string> = {
  completed: "Completed",
  in_progress: "In Progress",
  pending: "Pending",
  skipped: "Skipped",
};

export default async function CandidateDetailsPage({
  params,
}: PageProps<"/candidates/[id]">) {
  const { id } = await params;

  let data;
  try {
    const [candidate, engagement, communications] = await Promise.all([
      getCandidate(id),
      getEngagement(id),
      getCandidateCommunications(id),
    ]);
    data = { candidate, engagement, communications };
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const { candidate, engagement, communications } = data;

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

  const recentMessages: Message[] = communications.conversations
    .flatMap((c) => c.messages)
    .filter((m) => !m.is_internal_note && m.sent_at)
    .sort(
      (a, b) =>
        new Date(b.sent_at as string).getTime() -
        new Date(a.sent_at as string).getTime(),
    )
    .slice(0, 4);

  const risk = engagement.risk ?? {
    level: candidate.risk_level,
    score: candidate.risk_score,
    factors: [],
    summary: null,
  };

  const info: {
    label: string;
    value: string;
    glassIcon?: GlassIconName;
    icon?: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      label: "Recruiter",
      value: candidate.recruiter_name,
      glassIcon: "employee",
    },
    {
      label: "Source",
      value: candidate.source,
      glassIcon: "employee-details",
    },
    {
      label: "Department",
      value: candidate.department ?? "Not set",
      glassIcon: "organization",
    },
    {
      label: "Employment Type",
      value: candidate.employment_type.replace("_", " "),
      glassIcon: "jobs",
    },
    { label: "Location", value: candidate.location, icon: MapPinIcon },
  ];

  const note = candidate.latest_note;
  const pendingDocCount = engagement.pending_documents.length;
  const bannerText =
    pendingDocCount > 0
      ? `Waiting for the candidate to complete ${pendingDocCount} pending document${
          pendingDocCount === 1 ? "" : "s"
        }.`
      : "The engagement journey is on track. Keep the cadence steady.";

  return (
    <AppShell title="Candidate Details">
      <div className="mb-5 flex items-center justify-between">
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/candidates" className="font-semibold text-orange">
            Candidates
          </Link>
          <ChevronRightIcon className="h-3.5 w-3.5 text-text-secondary" />
          <span className="font-semibold text-charcoal">
            {candidate.full_name}
          </span>
        </nav>
        <Link
          href="/candidates"
          className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-charcoal hover:bg-cream"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Candidates
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <div className="flex flex-wrap items-start gap-5">
              <Avatar
                initials={candidate.initials}
                size="xl"
                tone="peach"
                online
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-heading text-2xl font-bold text-charcoal">
                    {candidate.full_name}
                  </h2>
                  <Badge tone="peach">
                    {STATUS_LABEL[candidate.status] ?? candidate.status}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-text-secondary">
                  {candidate.role}, {candidate.location_city ?? candidate.location}
                </p>
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-text-secondary">
                  <span className="flex items-center gap-1.5">
                    <GlassIcon name="email" size={20} />
                    {candidate.email}
                  </span>
                  {candidate.phone && (
                    <span className="flex items-center gap-1.5">
                      <GlassIcon name="phone_number" size={20} />
                      {candidate.phone}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-5 text-sm">
                  <span className="text-text-secondary">
                    Offered on:{" "}
                    <span className="font-semibold text-charcoal">
                      {formatDate(candidate.offer_date)}
                    </span>
                  </span>
                  <span className="text-text-secondary">
                    Joining on:{" "}
                    <span className="font-semibold text-charcoal">
                      {formatDate(candidate.joining_date)}
                      {candidate.joining_in_days >= 0
                        ? ` (in ${candidate.joining_in_days} days)`
                        : ""}
                    </span>
                  </span>
                </div>
              </div>
              <div className="flex w-44 flex-col gap-2">
                <Link
                  href={`/communication?candidate=${candidate.slug}`}
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-orange px-4 py-2.5 text-sm font-semibold text-orange transition-colors hover:bg-peach/40"
                >
                  <GlassIcon name="email" size={20} />
                  Send Message
                </Link>
                <CandidateMoreActions
                  slug={candidate.slug}
                  email={candidate.email}
                  phone={candidate.phone}
                />
              </div>
            </div>
          </Card>

          <SectionCard
            title="Engagement Journey"
            action="View Full Journey"
            actionHref={`/engagement-journey?candidate=${candidate.slug}`}
          >
            <JourneyStepper steps={steps} />
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-peach/40 px-4 py-3 text-sm">
              <span className="flex items-center gap-2 text-charcoal">
                <InformationCircleIcon className="h-4 w-4 text-orange" />
                {bannerText}
              </span>
              <Link
                href={`/engagement-journey?candidate=${candidate.slug}`}
                className="flex items-center gap-1 font-semibold text-orange"
              >
                View Documents
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </Link>
            </div>
          </SectionCard>

          <CandidateAiPanel slug={candidate.slug} />

          <div className="grid gap-4 md:grid-cols-2">
            <SectionCard
              title="Recent Communications"
              action="View All"
              actionHref="/communication"
              footer={{ label: "Go to Communication", href: "/communication" }}
            >
              {recentMessages.length === 0 ? (
                <p className="py-6 text-center text-sm text-text-secondary">
                  No messages yet.
                </p>
              ) : (
                <ul className="space-y-4">
                  {recentMessages.map((m) => (
                    <li key={m.id} className="flex gap-3">
                      <GlassIcon
                        name={m.channel === "email" ? "email" : "messages"}
                        size={30}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-charcoal">
                          {m.subject ?? m.body.slice(0, 48)}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {m.direction === "outbound"
                            ? `Sent to ${candidate.full_name}`
                            : `From ${candidate.full_name}`}
                        </p>
                      </div>
                      <span className="whitespace-nowrap text-xs text-text-secondary">
                        {relativeTime(m.sent_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard
              title="Upcoming / Pending Actions"
              action="View All"
              actionHref={`/engagement-journey?candidate=${candidate.slug}`}
              footer={{
                label: "Go to Engagement Journey",
                href: `/engagement-journey?candidate=${candidate.slug}`,
              }}
            >
              {engagement.upcoming_tasks.length === 0 ? (
                <p className="py-6 text-center text-sm text-text-secondary">
                  No pending actions.
                </p>
              ) : (
                <ul className="space-y-4">
                  {engagement.upcoming_tasks.map((t) => (
                    <li key={t.id} className="flex items-start gap-3">
                      <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-border" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-charcoal">
                          {t.title}
                        </p>
                        {t.detail && (
                          <p className="text-xs text-text-secondary">
                            {t.detail}
                          </p>
                        )}
                      </div>
                      {t.due_date && (
                        <span className="flex items-center gap-1 whitespace-nowrap text-xs text-text-secondary">
                          <GlassIcon name="leave" size={14} />
                          {formatDate(t.due_date)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <h3 className="font-heading text-base font-semibold text-charcoal">
              Engagement Risk
            </h3>
            <div className="mt-3 flex items-start justify-between">
              <div>
                <Badge
                  tone={
                    risk.level === "high"
                      ? "coral"
                      : risk.level === "medium"
                        ? "amber"
                        : "teal"
                  }
                  dot
                >
                  {riskLabel(risk.level)} Risk
                </Badge>
                <p className="mt-4 text-sm text-text-secondary">Risk Score</p>
                <p className="font-heading text-3xl font-bold text-charcoal">
                  {risk.score}/100
                </p>
              </div>
              <RiskGauge score={risk.score} />
            </div>
            <p className="mt-3 text-sm text-text-secondary">
              {candidate.days_since_interaction == null
                ? "No interaction recorded yet."
                : `Last interaction was ${relativeDays(
                    candidate.days_since_interaction,
                  ).toLowerCase()}. ${
                    risk.level === "low"
                      ? "Engagement looks healthy."
                      : "Consider reaching out."
                  }`}
            </p>
            <Link
              href={`/engagement-journey?candidate=${candidate.slug}`}
              className="mt-4 block w-full rounded-xl border border-orange py-2.5 text-center text-sm font-semibold text-orange hover:bg-peach/40"
            >
              View Risk Insights
            </Link>
          </Card>

          <Card>
            <h3 className="font-heading text-base font-semibold text-charcoal">
              Candidate Information
            </h3>
            <dl className="mt-4 space-y-3 text-sm">
              {info.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-3"
                >
                  <dt className="flex items-center gap-2 text-text-secondary">
                    {row.glassIcon ? (
                      <GlassIcon name={row.glassIcon} size={16} />
                    ) : row.icon ? (
                      <row.icon className="h-4 w-4" />
                    ) : null}
                    {row.label}
                  </dt>
                  <dd className="text-right font-semibold capitalize text-charcoal">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>

          <RiskOverrideControl slug={candidate.slug} />

          <HrNotesCard slug={candidate.slug} initialNote={note} />
        </div>
      </div>
    </AppShell>
  );
}
