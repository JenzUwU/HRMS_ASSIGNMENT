import Link from "next/link";
import {
  CalendarDaysIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  EnvelopeIcon,
  EllipsisVerticalIcon,
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
import {
  candidates,
  funnelData,
  recentCommunications,
  upcomingActions,
} from "@/lib/mock-data";

const statIcons = [UsersIcon, CalendarDaysIcon, ExclamationTriangleIcon, CheckCircleIcon];
const statTones = ["orange", "peach", "coral", "teal"] as const;

const stats = [
  { label: "Total Offered Candidates", value: "248", delta: "12.4%", deltaDir: "up" as const, sub: "vs last month" },
  { label: "Joining in Next 7 Days", value: "36", sub: "14.5% of total offered" },
  { label: "High-Risk Candidates", value: "28", sub: "11.3% of total offered" },
  { label: "Pending Engagements", value: "132", delta: "8.7%", deltaDir: "up" as const, sub: "vs last month" },
];

const quickAccess = [
  { label: "Candidates", href: "/candidates", icon: UsersIcon },
  { label: "Engagement Journey", href: "/engagement-journey", icon: Squares2X2Icon },
  { label: "Communication", href: "/communication", icon: MegaphoneIcon },
  { label: "Analytics", href: "/analytics", icon: ChartBarIcon },
];

export default function DashboardPage() {
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
          28 May 2025, Wednesday
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s, i) => (
          <StatCard
            key={s.label}
            {...s}
            icon={statIcons[i]}
            iconTone={statTones[i]}
          />
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <SectionCard
          title="Engagement Journey"
          footer={{ label: "View Full Journey Report", href: "/engagement-journey" }}
        >
          <p className="mb-3 text-xs font-medium text-text-secondary">May 2025</p>
          <EngagementFunnel data={funnelData} />
        </SectionCard>

        <SectionCard
          title="Upcoming Actions"
          action="View All"
          actionHref="/engagement-journey"
          footer={{ label: "Go to Engagement Journey", href: "/engagement-journey" }}
        >
          <ul className="space-y-4">
            {upcomingActions.map((a) => (
              <li key={a.id} className="flex items-center gap-3">
                <Avatar initials={a.initials} size="sm" tone="peach" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-charcoal">
                    {a.name}
                  </p>
                  <p className="truncate text-xs text-text-secondary">{a.note}</p>
                </div>
                <span className="flex items-center gap-1 whitespace-nowrap text-xs font-medium text-text-secondary">
                  <CalendarDaysIcon className="h-3.5 w-3.5" />
                  {a.date}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="Recent Communications"
          action="View All"
          actionHref="/communication"
          footer={{ label: "Go to Communication", href: "/communication" }}
        >
          <ul className="space-y-4">
            {recentCommunications.map((c) => (
              <li key={c.id} className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-peach text-orange">
                  {c.type === "email" ? (
                    <EnvelopeIcon className="h-4 w-4" />
                  ) : (
                    <ChatBubbleLeftRightIcon className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-charcoal">
                    {c.title}
                  </p>
                  <p className="truncate text-xs text-text-secondary">
                    Sent to {c.to}
                  </p>
                </div>
                <span className="whitespace-nowrap text-xs text-text-secondary">
                  {c.time}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <SectionCard
          title="Candidates Needing Attention"
          className="lg:col-span-2"
          footer={{ label: "View All at Risk Candidates", href: "/candidates" }}
        >
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
                {candidates.slice(0, 5).map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="py-3">
                      <Link
                        href={`/candidates/${c.id}`}
                        className="flex items-center gap-2 font-semibold text-charcoal hover:text-orange"
                      >
                        <Avatar initials={c.initials} size="sm" tone="peach" />
                        {c.name}
                      </Link>
                    </td>
                    <td className="py-3 text-text-secondary">{c.joiningDate}</td>
                    <td className="py-3 text-text-secondary">
                      {c.lastInteraction}
                    </td>
                    <td className="py-3">
                      <RiskBadge level={c.riskLevel} />
                    </td>
                    <td className="py-3 text-text-secondary">{c.nextAction}</td>
                    <td className="py-3 text-right">
                      <EllipsisVerticalIcon className="h-4 w-4 text-text-secondary" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
