import {
  ArrowTrendingUpIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  FlagIcon,
  FunnelIcon,
  InformationCircleIcon,
  UserIcon,
  UsersIcon,
} from "@heroicons/react/24/solid";
import { AppShell } from "@/components/layout/AppShell";
import { Card, SectionCard } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { TrendChart } from "@/components/charts/TrendChart";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/api-client";
import {
  getAnalyticsSummary,
  getConversionTrend,
  getRecruiterConversion,
  getStageFunnel,
} from "@/lib/api";
import { STAGE_LABEL, formatDate } from "@/lib/format";
import { notFound } from "next/navigation";

const STAGE_ICON = [
  CheckCircleIcon,
  EnvelopeIcon,
  DocumentTextIcon,
  UserIcon,
  CalendarDaysIcon,
  FlagIcon,
];

function retainedColor(pct: number) {
  if (pct >= 90) return "bg-teal";
  if (pct >= 70) return "bg-teal/70";
  if (pct >= 55) return "bg-orange/80";
  if (pct >= 45) return "bg-orange";
  return "bg-charcoal/40";
}

export default async function AnalyticsPage() {
  let data;
  try {
    const [summary, funnel, recruiters, trend] = await Promise.all([
      getAnalyticsSummary(),
      getStageFunnel(),
      getRecruiterConversion(),
      getConversionTrend(),
    ]);
    data = { summary, funnel, recruiters, trend };
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const { summary, funnel, recruiters, trend } = data;

  const base = funnel[0]?.candidates_reached ?? 0;
  const stageRows = funnel.map((f, i) => {
    const prev = i === 0 ? f.candidates_reached : funnel[i - 1].candidates_reached;
    const dropoff = Math.max(0, prev - f.candidates_reached);
    const dropoffPct = prev > 0 ? Math.round((dropoff / prev) * 1000) / 10 : 0;
    const retained =
      base > 0 ? Math.round((f.candidates_reached / base) * 1000) / 10 : 0;
    return { ...f, dropoff, dropoffPct, retained };
  });

  const trendData = trend.map((t) => ({
    week: formatDate(t.week_start).replace(/ \d{4}$/, ""),
    value: t.cumulative_conversion_rate ?? 0,
  }));

  const totalOffered = recruiters.reduce((s, r) => s + r.offered, 0);
  const totalJoined = recruiters.reduce((s, r) => s + r.joined, 0);
  const avgRate =
    totalOffered > 0 ? Math.round((totalJoined / totalOffered) * 1000) / 10 : 0;

  const kpis = [
    {
      label: "Total Offered Candidates",
      value: String(summary.total_offered),
      sub: `${summary.joined} joined, ${summary.declined} declined, ${summary.in_progress} in progress`,
      icon: UsersIcon,
    },
    {
      label: "Offer-to-Join Conversion",
      value: `${summary.resolved_conversion_rate}%`,
      sub: `${summary.joined} of ${summary.joined + summary.declined} resolved candidates joined`,
      icon: ArrowTrendingUpIcon,
    },
    {
      label: "High-Risk Candidates",
      value: String(summary.high_risk_candidates),
      sub:
        summary.total_offered > 0
          ? `${Math.round(
              (summary.high_risk_candidates / summary.total_offered) * 100,
            )}% of all offered`
          : "",
      icon: ExclamationTriangleIcon,
    },
    {
      label: "Average Engagement Frequency",
      value: String(summary.average_engagement_frequency),
      sub: "engagement events per candidate",
      icon: ChartBarIcon,
    },
  ];

  return (
    <AppShell
      title="Analytics Dashboard"
      searchPlaceholder="Search reports, recruiters, roles..."
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          Track post-offer engagement and conversion performance.
        </p>
        <div className="flex gap-2">
          <span className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-charcoal">
            <CalendarDaysIcon className="h-4 w-4 text-orange" />
            All offered candidates
          </span>
          <button className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-charcoal hover:bg-cream">
            <FunnelIcon className="h-4 w-4" />
            Filter
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.slice(0, 2).map((k) => (
          <Kpi key={k.label} {...k} />
        ))}

        <Card className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-orange/12 text-orange">
              <CalendarDaysIcon className="h-5 w-5" />
            </span>
            <span className="text-sm font-medium text-text-secondary">
              Candidates Joining in
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { window: "7 Days", value: summary.joining_next_7_days },
              { window: "15 Days", value: summary.joining_next_15_days },
              { window: "30 Days", value: summary.joining_next_30_days },
            ].map((j) => (
              <div key={j.window}>
                <p className="text-xs text-text-secondary">{j.window}</p>
                <p className="font-heading text-2xl font-bold text-charcoal">
                  {j.value}
                </p>
              </div>
            ))}
          </div>
        </Card>

        {kpis.slice(2).map((k) => (
          <Kpi key={k.label} {...k} />
        ))}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <SectionCard title="Stage Drop-offs">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  <th className="pb-3">Stage</th>
                  <th className="pb-3">Reached</th>
                  <th className="pb-3">Drop-off</th>
                  <th className="pb-3 text-right">Retained</th>
                </tr>
              </thead>
              <tbody>
                {stageRows.map((s, i) => {
                  const Icon = STAGE_ICON[i] ?? FlagIcon;
                  return (
                    <tr key={s.stage} className="border-t border-border">
                      <td className="py-2.5">
                        <span className="flex items-center gap-2 font-medium text-charcoal">
                          <Icon className="h-4 w-4 text-teal" />
                          {STAGE_LABEL[s.stage] ?? s.stage}
                        </span>
                      </td>
                      <td className="py-2.5 text-text-secondary">
                        {s.candidates_reached}
                      </td>
                      <td className="py-2.5 text-text-secondary">
                        {s.dropoff > 0
                          ? `${s.dropoff} (${s.dropoffPct}%)`
                          : "0"}
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center justify-end gap-2">
                          <span
                            className={cn(
                              "h-4 rounded",
                              retainedColor(s.retained),
                            )}
                            style={{ width: `${Math.max(12, s.retained)}%` }}
                          />
                          <span className="w-14 text-right font-semibold text-charcoal">
                            {s.retained}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-peach/40 px-4 py-3 text-sm">
            <span className="font-semibold text-charcoal">
              Overall Offer-to-Join Conversion
            </span>
            <span className="font-heading text-lg font-bold text-orange">
              {summary.resolved_conversion_rate}%
            </span>
          </div>
        </SectionCard>

        <SectionCard title="Recruiter-wise Offer-to-Join Rate">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  <th className="pb-3">Recruiter</th>
                  <th className="pb-3">Offered</th>
                  <th className="pb-3">Joined</th>
                  <th className="pb-3 text-right">Offer-to-Join Rate</th>
                </tr>
              </thead>
              <tbody>
                {recruiters.map((r) => (
                  <tr key={r.recruiter_id} className="border-t border-border">
                    <td className="py-2.5">
                      <span className="flex items-center gap-2 font-medium text-charcoal">
                        <Avatar initials={r.initials} size="sm" tone="peach" />
                        {r.recruiter_name}
                      </span>
                    </td>
                    <td className="py-2.5 text-text-secondary">{r.offered}</td>
                    <td className="py-2.5 text-text-secondary">{r.joined}</td>
                    <td className="py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-24 rounded-full bg-border">
                          <div
                            className="h-full rounded-full bg-teal"
                            style={{ width: `${r.offer_to_join_rate ?? 0}%` }}
                          />
                        </div>
                        <span className="w-12 text-right font-semibold text-charcoal">
                          {r.offer_to_join_rate ?? 0}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-peach/40 px-4 py-3 text-sm">
            <span className="font-semibold text-charcoal">Total / Average</span>
            <span className="flex gap-6 font-heading font-bold text-orange">
              <span>{totalOffered}</span>
              <span>{totalJoined}</span>
              <span>{avgRate}%</span>
            </span>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Offer-to-Join Conversion Trend" className="mt-5">
        {trendData.length > 1 ? (
          <TrendChart data={trendData} />
        ) : (
          <p className="py-10 text-center text-sm text-text-secondary">
            Not enough history to plot a trend yet.
          </p>
        )}
        <p className="mt-2 flex items-center gap-1.5 text-xs text-text-secondary">
          <InformationCircleIcon className="h-3.5 w-3.5" />
          Cumulative conversion by week, calculated as joined divided by offered
          for all candidates offered up to that week.
        </p>
      </SectionCard>
    </AppShell>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-orange/12 text-orange">
          <Icon className="h-5 w-5" />
        </span>
        <span className="text-sm font-medium text-text-secondary">{label}</span>
      </div>
      <p className="font-heading text-3xl font-semibold text-charcoal">{value}</p>
      {sub && <p className="text-xs text-text-secondary">{sub}</p>}
    </Card>
  );
}
