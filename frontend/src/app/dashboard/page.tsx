import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Card, SectionCard } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { GlassIcon, type GlassIconName } from "@/components/ui/GlassIcon";
import { Avatar } from "@/components/ui/Avatar";
import { AttentionTable } from "@/components/dashboard/AttentionTable";
import { EngagementFunnel } from "@/components/charts/EngagementFunnel";
import { ApiError } from "@/lib/api-client";
import {
  getAnalyticsSummary,
  getCandidates,
  getConversations,
  getStageFunnel,
} from "@/lib/api";
import { STAGE_LABEL, formatDate, relativeTime } from "@/lib/format";

const quickAccess: { label: string; href: string; icon: GlassIconName }[] = [
  { label: "Candidates", href: "/candidates", icon: "employees" },
  { label: "Engagement Journey", href: "/engagement-journey", icon: "tasks" },
  { label: "Communication", href: "/communication", icon: "messages" },
  { label: "Analytics", href: "/analytics", icon: "analytics" },
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
      glassIcon: "employees" as const,
    },
    {
      label: "Joining in Next 7 Days",
      value: String(summary.joining_next_7_days),
      sub: `${summary.joining_next_15_days} within 15 days`,
      glassIcon: "leave" as const,
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
      glassIcon: "security" as const,
    },
    {
      label: "Pending Engagements",
      value: String(summary.in_progress),
      sub: "candidates still in the journey",
      glassIcon: "tasks" as const,
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
          <GlassIcon name="leave" size={18} />
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
            <ul className="space-y-2">
              {active.items.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/candidates/${c.slug}`}
                    className="group/row -mx-2 flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 ring-1 ring-transparent transition duration-200 hover:-translate-y-px hover:bg-orange/[0.04] hover:shadow-[0_8px_20px_-10px_rgba(252,128,25,0.25)] hover:ring-orange/20"
                  >
                    <Avatar
                      initials={c.initials}
                      size="sm"
                      tone="peach"
                      className="transition duration-200 group-hover/row:-translate-y-px group-hover/row:brightness-105"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-charcoal transition-colors group-hover/row:text-orange">
                        {c.full_name}
                      </p>
                      <p className="truncate text-xs text-text-secondary">
                        {c.next_action ?? "Follow up"}
                      </p>
                    </div>
                    <span className="flex items-center gap-1 whitespace-nowrap text-xs font-medium text-text-secondary">
                      <GlassIcon name="leave" size={14} />
                      {formatDate(c.joining_date)}
                    </span>
                  </Link>
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
            <ul className="space-y-2">
              {conversations.items.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/communication?c=${c.id}`}
                    className="group/row -mx-2 flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 ring-1 ring-transparent transition duration-200 hover:-translate-y-px hover:bg-orange/[0.04] hover:shadow-[0_8px_20px_-10px_rgba(252,128,25,0.25)] hover:ring-orange/20"
                  >
                    <GlassIcon
                      name={c.channel === "email" ? "email" : "messages"}
                      size={34}
                      className="transition duration-200 group-hover/row:-translate-y-px group-hover/row:brightness-105"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-charcoal transition-colors group-hover/row:text-orange">
                        {c.subject}
                      </p>
                      <p className="truncate text-xs text-text-secondary">
                        {c.candidate_name ?? "Unknown"}
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-xs text-text-secondary">
                      {relativeTime(c.last_message_at)}
                    </span>
                  </Link>
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
          <AttentionTable items={highRisk.items} />
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
                <GlassIcon name={q.icon} size={40} />
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
