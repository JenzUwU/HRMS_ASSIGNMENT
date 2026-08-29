import Link from "next/link";
import { InformationCircleIcon } from "@heroicons/react/24/solid";
import { AppShell } from "@/components/layout/AppShell";
import { Card, SectionCard } from "@/components/ui/Card";
import { GlassIcon, type GlassIconName } from "@/components/ui/GlassIcon";
import { Avatar } from "@/components/ui/Avatar";
import { TrendChart } from "@/components/charts/TrendChart";
import { AnalyticsFilter } from "@/components/analytics/AnalyticsFilter";
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

const STAGE_GLASS: GlassIconName[] = [
  "tasks",
  "email",
  "documents",
  "employee",
  "leave",
  "jobs",
];

// Brand orange throughout the card; only the intensity shifts with retention.
function retainedColor(pct: number) {
  if (pct >= 75) return "bg-orange";
  if (pct >= 50) return "bg-orange/80";
  if (pct >= 30) return "bg-orange/60";
  return "bg-orange/40";
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

  const kpis: {
    label: string;
    value: string;
    sub?: string;
    glassIcon: GlassIconName;
    href?: string;
  }[] = [
    {
      label: "Total Offered Candidates",
      value: String(summary.total_offered),
      sub: `${summary.joined} joined, ${summary.declined} declined, ${summary.in_progress} in progress`,
      glassIcon: "employees",
      href: "/candidates",
    },
    {
      label: "Offer-to-Join Conversion",
      value: `${summary.resolved_conversion_rate}%`,
      sub: `${summary.joined} of ${summary.joined + summary.declined} resolved candidates joined`,
      glassIcon: "analytics",
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
      glassIcon: "security",
      href: "/candidates?risk=high",
    },
    {
      label: "Average Engagement Frequency",
      value: String(summary.average_engagement_frequency),
      sub: "engagement events per candidate",
      glassIcon: "attendance",
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
            <GlassIcon name="leave" size={18} />
            All offered candidates
          </span>
          <AnalyticsFilter
            recruiters={recruiters.map((r) => ({
              recruiter_id: r.recruiter_id,
              recruiter_name: r.recruiter_name,
            }))}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.slice(0, 2).map((k) => (
          <Kpi key={k.label} {...k} />
        ))}

        <Card className="flex h-full flex-col gap-3">
          <div className="flex items-center gap-3">
            <GlassIcon
              name="leave"
              size={40}
              className="transition-transform duration-200 group-hover/card:scale-105"
            />
            <span className="text-sm font-medium text-text-secondary">
              Candidates Joining in
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center transition-transform duration-200 group-hover/card:-translate-y-0.5">
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
                  const glass = STAGE_GLASS[i] ?? "jobs";
                  return (
                    <tr
                      key={s.stage}
                      className="group/row border-t border-border transition-colors hover:bg-peach/20"
                    >
                      <td className="py-2.5">
                        <span className="flex items-center gap-2 font-medium text-charcoal transition-colors group-hover/row:text-orange">
                          <GlassIcon
                            name={glass}
                            size={16}
                            className="transition-transform duration-200 group-hover/row:-translate-y-0.5"
                          />
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
                  <tr
                    key={r.recruiter_id}
                    className="group/row border-t border-border transition-colors hover:bg-peach/20"
                  >
                    <td className="py-2.5">
                      <Link
                        href={`/candidates?recruiter=${r.recruiter_id}`}
                        title={`View ${r.recruiter_name}'s candidates`}
                        className="flex items-center gap-2 font-medium text-charcoal transition-colors group-hover/row:text-orange hover:underline"
                      >
                        <Avatar
                          initials={r.initials}
                          size="sm"
                          tone="peach"
                          className="transition-transform duration-200 group-hover/row:-translate-y-px"
                        />
                        {r.recruiter_name}
                      </Link>
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
  glassIcon,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  glassIcon: GlassIconName;
  href?: string;
}) {
  const body = (
    <Card className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-3">
        <GlassIcon
          name={glassIcon}
          size={40}
          className="transition-transform duration-200 group-hover/card:scale-105"
        />
        <span className="text-sm font-medium text-text-secondary">{label}</span>
      </div>
      <p className="font-heading text-3xl font-semibold text-charcoal transition-transform duration-200 group-hover/card:-translate-y-0.5">
        {value}
      </p>
      {sub && <p className="text-xs text-text-secondary">{sub}</p>}
    </Card>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}
