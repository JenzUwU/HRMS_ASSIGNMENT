import {
  ArrowDownIcon,
  ArrowTrendingUpIcon,
  ArrowUpIcon,
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
import {
  analyticsStats,
  conversionTrend,
  joiningWindow,
  recruiterRates,
  stageDropoffs,
} from "@/lib/mock-data";

const kpiIcons = [UsersIcon, ArrowTrendingUpIcon, CalendarDaysIcon, ExclamationTriangleIcon, ChartBarIcon];
const stageIcons = [CheckCircleIcon, EnvelopeIcon, DocumentTextIcon, UserIcon, CalendarDaysIcon, FlagIcon];

function funnelColor(retained: number) {
  if (retained >= 90) return "bg-teal";
  if (retained >= 70) return "bg-teal/70";
  if (retained >= 55) return "bg-orange/80";
  if (retained >= 45) return "bg-orange";
  return "bg-charcoal/40";
}

export default function AnalyticsPage() {
  return (
    <AppShell title="Analytics Dashboard" searchPlaceholder="Search reports, recruiters, roles...">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          Track post-offer engagement and conversion performance.
        </p>
        <div className="flex gap-2">
          <span className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-charcoal">
            <CalendarDaysIcon className="h-4 w-4 text-orange" />
            20 May 2025 - 19 Jun 2025
          </span>
          <button className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-charcoal hover:bg-cream">
            <FunnelIcon className="h-4 w-4" />
            Filter
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {analyticsStats.slice(0, 2).map((s, i) => (
          <Kpi key={s.label} {...s} icon={kpiIcons[i]} />
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
            {joiningWindow.map((j) => (
              <div key={j.window}>
                <p className="text-xs text-text-secondary">{j.window}</p>
                <p className="font-heading text-2xl font-bold text-charcoal">
                  {j.value}
                </p>
                <p className="flex items-center justify-center gap-0.5 text-[11px] font-semibold text-teal">
                  <ArrowUpIcon className="h-2.5 w-2.5" />
                  {j.delta}
                </p>
              </div>
            ))}
          </div>
        </Card>

        {analyticsStats.slice(2).map((s, i) => (
          <Kpi key={s.label} {...s} icon={kpiIcons[i + 3]} />
        ))}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <SectionCard title="Stage Drop-offs">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  <th className="pb-3">Stage</th>
                  <th className="pb-3">Candidates</th>
                  <th className="pb-3">Drop-off</th>
                  <th className="pb-3 text-right">Retained</th>
                </tr>
              </thead>
              <tbody>
                {stageDropoffs.map((s, i) => {
                  const Icon = stageIcons[i];
                  return (
                    <tr key={s.stage} className="border-t border-border">
                      <td className="py-2.5">
                        <span className="flex items-center gap-2 font-medium text-charcoal">
                          <Icon className="h-4 w-4 text-teal" />
                          {s.stage}
                        </span>
                      </td>
                      <td className="py-2.5 text-text-secondary">
                        {s.candidates}
                      </td>
                      <td className="py-2.5 text-text-secondary">
                        {s.dropoff > 0 ? `${s.dropoff} (${s.dropoffPct}%)` : "0"}
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center justify-end gap-2">
                          <span
                            className={cn(
                              "h-4 rounded",
                              funnelColor(s.retained),
                            )}
                            style={{ width: `${Math.max(12, s.retained)}%` }}
                          />
                          <span className="w-12 text-right font-semibold text-charcoal">
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
              62.5%
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
                {recruiterRates.map((r) => (
                  <tr key={r.recruiter} className="border-t border-border">
                    <td className="py-2.5">
                      <span className="flex items-center gap-2 font-medium text-charcoal">
                        <Avatar initials={r.initials} size="sm" tone="peach" />
                        {r.recruiter}
                      </span>
                    </td>
                    <td className="py-2.5 text-text-secondary">{r.offered}</td>
                    <td className="py-2.5 text-text-secondary">{r.joined}</td>
                    <td className="py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-24 rounded-full bg-border">
                          <div
                            className="h-full rounded-full bg-teal"
                            style={{ width: `${r.rate}%` }}
                          />
                        </div>
                        <span className="w-12 text-right font-semibold text-charcoal">
                          {r.rate}%
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
              <span>248</span>
              <span>134</span>
              <span>62.5%</span>
            </span>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Offer-to-Join Conversion Trend" className="mt-5">
        <TrendChart data={conversionTrend} />
        <p className="mt-2 flex items-center gap-1.5 text-xs text-text-secondary">
          <InformationCircleIcon className="h-3.5 w-3.5" />
          Conversion rate is calculated as Joined divided by Offered.
        </p>
      </SectionCard>
    </AppShell>
  );
}

function Kpi({
  label,
  value,
  delta,
  deltaDir,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaDir?: string;
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
      <p className="flex items-center gap-1.5 text-xs">
        <span
          className={cn(
            "inline-flex items-center gap-0.5 font-semibold",
            deltaDir === "down" ? "text-coral" : "text-teal",
          )}
        >
          {deltaDir === "down" ? (
            <ArrowDownIcon className="h-3 w-3" />
          ) : (
            <ArrowUpIcon className="h-3 w-3" />
          )}
          {delta}
        </span>
        <span className="text-text-secondary">{sub}</span>
      </p>
    </Card>
  );
}
