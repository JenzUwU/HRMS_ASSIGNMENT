import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarDaysIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  EllipsisVerticalIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  MegaphoneIcon,
  Squares2X2Icon,
  UsersIcon,
} from "@heroicons/react/24/solid";
import { AppShell } from "@/components/layout/AppShell";
import { Card, SectionCard } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Avatar } from "@/components/ui/Avatar";
import { RiskBadge } from "@/components/ui/Badge";
import { EngagementFunnel } from "@/components/charts/EngagementFunnel";
import { ApiError } from "@/lib/api-client";
import {
  getAnalyticsSummary,
  getCandidates,
  getConversations,
  getStageFunnel,
} from "@/lib/api";
import { STAGE_LABEL, formatDate, relativeDays, relativeTime, riskLabel } from "@/lib/format";

const quickAccess = [
  { label: "Candidates", href: "/candidates", icon: UsersIcon },
  { label: "Engagement Journey", href: "/engagement-journey", icon: Squares2X2Icon },
  { label: "Communication", href: "/communication", icon: MegaphoneIcon },
  { label: "Analytics", href: "/analytics", icon: ChartBarIcon },
];

export default async function DashboardPage() {
  let data;
  try {
    const [summary, funnel, conversations, active, highRisk] = await Promise.all([
      getAnalyticsSummary(),
      getStageFunnel(),
      getConversations(1, 5),
      getCandidates({ status: "active", page_size: 5 }),
      getCandidates({ risk_level: "high", page_size: 5 }),
    ]);
    data = { summary, funnel, conversations, active, highRisk };
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const { summary, funnel, conversations, active, highRisk } = data;

  const base = funnel[0]?.candidates_reached ?? 0;
  const funnelData = funnel.map((f) => ({
    label: STAGE_LABEL[f.stage] ?? f.stage,
    value: f.candidates_reached,
    pct: base > 0 ? Math.round((f.candidates_reached / base) * 1000) / 10 : 0,
  }));

  const stats = [
    {
      label: "Total Offered Candidates",
      value: String(summary.total_offered),
      sub: `${summary.joined} joined so far`,
      icon: UsersIcon,
      iconTone: "orange" as const,
    },
    {
      label: "Joining in Next 7 Days",
      value: String(summary.joining_next_7_days),
      sub: `${summary.joining_next_15_days} within 15 days`,
      icon: CalendarDaysIcon,
      iconTone: "peach" as const,
    },
    {
      label: "High-Risk Candidates",
      value: String(summary.high_risk_candidates),
      sub:
        summary.total_offered > 0
          ? `${Math.round(
              (summary.high_risk_candidates / summary.total_offered) * 100,
            )}% of total offered`
          : "",
      icon: ExclamationTriangleIcon,
      iconTone: "coral" as const,
    },
    {
      label: "Pending Engagements",
      value: String(summary.in_progress),
      sub: "candidates still in the journey",
      icon: CheckCircleIcon,
      iconTone: "teal" as const,
    },
  ];

  const today = new Date();
  const dateLabel = `${today.getDate()} ${today.toLocaleString("en-GB", {
    month: "long",
  })} ${today.getFullYear()}, ${today.toLocaleString("en-GB", {
    weekday: "long",
  })}`;

  return (
    <AppShell title="Dashboard">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold text-charcoal">
            Good morning, Admin
          </h2>
          <p className="text-sm text-text-secondary">
            Here is what is happening in your post offer engagement today.
          </p>
        </div>
        <span className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-charcoal">
          <CalendarDaysIcon className="h-4 w-4 text-orange" />
          {dateLabel}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <SectionCard
          title="Engagement Journey"
          footer={{
            label: "View Full Journey Report",
            href: "/analytics",
          }}
        >
          <p className="mb-3 text-xs font-medium text-text-secondary">
            Candidates reached each stage
          </p>
          <EngagementFunnel data={funnelData} />
        </SectionCard>

        <SectionCard
          title="Upcoming Actions"
          action="View All"
          actionHref="/candidates"
          footer={{ label: "Go to Candidates", href: "/candidates" }}
        >
          {active.items.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-secondary">
              No pending actions.
            </p>
          ) : (
            <ul className="space-y-4">
              {active.items.map((c) => (
                <li key={c.id} className="flex items-center gap-3">
                  <Avatar initials={c.initials} size="sm" tone="peach" />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/candidates/${c.slug}`}
                      className="truncate text-sm font-semibold text-charcoal hover:text-orange"
                    >
                      {c.full_name}
                    </Link>
                    <p className="truncate text-xs text-text-secondary">
                      {c.next_action ?? "Follow up"}
                    </p>
                  </div>
                  <span className="flex items-center gap-1 whitespace-nowrap text-xs font-medium text-text-secondary">
                    <CalendarDaysIcon className="h-3.5 w-3.5" />
                    {formatDate(c.joining_date)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Recent Communications"
          action="View All"
          actionHref="/communication"
          footer={{ label: "Go to Communication", href: "/communication" }}
        >
          {conversations.items.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-secondary">
              No recent messages.
            </p>
          ) : (
            <ul className="space-y-4">
              {conversations.items.map((c) => (
                <li key={c.id} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-peach text-orange">
                    {c.channel === "email" ? (
                      <EnvelopeIcon className="h-4 w-4" />
                    ) : (
                      <ChatBubbleLeftRightIcon className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-charcoal">
                      {c.subject}
                    </p>
                    <p className="truncate text-xs text-text-secondary">
                      {c.candidate_name ?? "Unknown"}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-text-secondary">
                    {relativeTime(c.last_message_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <SectionCard
          title="Candidates Needing Attention"
          className="lg:col-span-2"
          footer={{ label: "View All at Risk Candidates", href: "/candidates" }}
        >
          {highRisk.items.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-secondary">
              No high-risk candidates right now.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    <th className="pb-3">Candidate</th>
                    <th className="pb-3">Joining Date</th>
                    <th className="pb-3">Last Interaction</th>
                    <th className="pb-3">Risk Level</th>
                    <th className="pb-3">Recommended Next Action</th>
                    <th className="pb-3" />
                  </tr>
                </thead>
                <tbody>
                  {highRisk.items.map((c) => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="py-3">
                        <Link
                          href={`/candidates/${c.slug}`}
                          className="flex items-center gap-2 font-semibold text-charcoal hover:text-orange"
                        >
                          <Avatar initials={c.initials} size="sm" tone="peach" />
                          {c.full_name}
                        </Link>
                      </td>
                      <td className="py-3 text-text-secondary">
                        {formatDate(c.joining_date)}
                      </td>
                      <td className="py-3 text-text-secondary">
                        {relativeDays(c.days_since_interaction)}
                      </td>
                      <td className="py-3">
                        <RiskBadge level={riskLabel(c.risk_level)} />
                      </td>
                      <td className="py-3 text-text-secondary">
                        {c.next_action ?? ""}
                      </td>
                      <td className="py-3 text-right">
                        <EllipsisVerticalIcon className="h-4 w-4 text-text-secondary" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <Card>
          <h3 className="font-heading text-base font-semibold text-charcoal">
            Quick Access
          </h3>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {quickAccess.map((q) => (
              <Link
                key={q.href}
                href={q.href}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-cream/60 px-3 py-5 text-center hover:border-orange/40 hover:bg-peach/40"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-orange/12 text-orange">
                  <q.icon className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold text-charcoal">
                  {q.label}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
