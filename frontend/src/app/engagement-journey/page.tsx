"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  ArrowUpTrayIcon,
  CalendarDaysIcon,
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
import {
  JOURNEY_STAGES,
  candidates,
  journeyTimeline,
  pendingActions,
  pendingDocuments,
  riskFactors,
} from "@/lib/mock-data";

const tabs = ["Journey Timeline", "Communications", "Tasks", "Notes", "Documents"];

export default function EngagementJourneyPage() {
  const candidate = candidates[0];
  const [tab, setTab] = useState(tabs[0]);

  const steps = JOURNEY_STAGES.map((stage, i) => ({
    label: stage.label,
    date:
      i === 0
        ? "20 May"
        : i === 1
          ? "20 May"
          : i === 2
            ? ""
            : i === 3
              ? "Due: 30 May"
              : i === 4
                ? "Due: 02 Jun"
                : "05 Jun",
    status:
      i < 2 ? ("completed" as const) : i === 2 ? ("in_progress" as const) : ("pending" as const),
    statusLabel:
      i < 2 ? "Completed" : i === 2 ? "In Progress" : i === 5 ? "Upcoming" : "Pending",
  }));

  return (
    <AppShell title="Engagement Journey">
      <div className="mb-5 flex items-center justify-between">
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/candidates" className="font-semibold text-orange">
            Candidates
          </Link>
          <ChevronRightIcon className="h-3.5 w-3.5 text-text-secondary" />
          <Link
            href={`/candidates/${candidate.id}`}
            className="font-semibold text-orange"
          >
            {candidate.name}
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
                  {candidate.name}
                </h2>
                <Badge tone="peach">{candidate.status}</Badge>
              </div>
              <p className="text-sm text-text-secondary">
                {candidate.role}, {candidate.location.split(",")[0]}
              </p>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-text-secondary">
                <span className="flex items-center gap-1">
                  <EnvelopeIcon className="h-3.5 w-3.5" />
                  {candidate.email}
                </span>
                <span>{candidate.phone}</span>
              </div>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap gap-8 text-sm">
            <div>
              <p className="text-xs text-text-secondary">Recruiter</p>
              <p className="flex items-center gap-2 font-semibold text-charcoal">
                <Avatar initials={candidate.recruiterInitials} size="sm" />
                {candidate.recruiter}
              </p>
              <p className="mt-2 text-xs text-text-secondary">Source</p>
              <p className="font-semibold text-charcoal">{candidate.source}</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Risk Level</p>
              <Badge tone="coral" dot>
                {candidate.riskLevel} Risk
              </Badge>
            </div>
            <div className="text-center">
              <p className="text-xs text-text-secondary">Engagement Score</p>
              <p className="font-heading text-2xl font-bold text-charcoal">
                {candidate.riskScore}/100
              </p>
              <RiskGauge score={candidate.riskScore} />
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
            {tabs.map((t) => (
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
            <ol className="relative space-y-6 border-l-2 border-border pl-6">
              {journeyTimeline.map((e) => (
                <li key={e.id} className="relative">
                  <span
                    className={
                      e.status === "completed"
                        ? "absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full bg-teal text-white"
                        : "absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full bg-orange text-white"
                    }
                  >
                    {e.status === "completed" ? (
                      <CheckCircleIcon className="h-4 w-4" />
                    ) : (
                      <DocumentTextIcon className="h-3 w-3" />
                    )}
                  </span>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-text-secondary">
                        {e.date} {e.time && `· ${e.time}`}
                      </p>
                      <p className="text-sm font-semibold text-charcoal">
                        {e.title}
                      </p>
                      <p className="text-sm text-text-secondary">{e.detail}</p>
                    </div>
                    <Badge tone={e.status === "completed" ? "teal" : "peach"}>
                      {e.tag}
                    </Badge>
                  </div>
                </li>
              ))}
            </ol>
            <Link
              href="#"
              className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-cream/70 py-3 text-sm font-semibold text-orange"
            >
              View Full Journey Activity Log
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </Card>

        <div className="space-y-4">
          <SectionCard
            title="Upcoming / Pending Actions"
            action="View All"
            actionHref="#"
            footer={{ label: "Go to Tasks", href: "#" }}
          >
            <ul className="space-y-4">
              {pendingActions.map((a) => (
                <li key={a.id} className="flex items-start gap-3">
                  <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-border" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-charcoal">
                      {a.title}
                    </p>
                    <p className="text-xs text-text-secondary">{a.detail}</p>
                  </div>
                  <span className="flex items-center gap-1 whitespace-nowrap text-xs text-text-secondary">
                    <CalendarDaysIcon className="h-3.5 w-3.5" />
                    {a.date}
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard
            title="Pending Documents"
            action="View All"
            actionHref="#"
            footer={{ label: "Go to Documents", href: "#" }}
          >
            <ul className="space-y-3">
              {pendingDocuments.map((d) => (
                <li key={d.id} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-charcoal">
                    <DocumentTextIcon className="h-4 w-4 text-text-secondary" />
                    {d.name}
                  </span>
                  <Badge tone={d.status === "Submitted" ? "teal" : "amber"}>
                    {d.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </SectionCard>

          <Card>
            <h3 className="font-heading text-base font-semibold text-charcoal">
              Engagement Risk
            </h3>
            <div className="mt-2">
              <Badge tone="coral" dot>
                {candidate.riskLevel} Risk
              </Badge>
            </div>
            <p className="mt-3 text-sm font-semibold text-charcoal">Risk Factors</p>
            <ul className="mt-2 space-y-1.5 text-sm text-text-secondary">
              {riskFactors.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-coral" />
                  {f}
                </li>
              ))}
            </ul>
            <button className="mt-4 w-full rounded-xl border border-orange py-2.5 text-sm font-semibold text-orange hover:bg-peach/40">
              View Risk Insights
            </button>
          </Card>

          <Card>
            <h3 className="font-heading text-base font-semibold text-charcoal">
              Journey Progress
            </h3>
            <div className="mt-3 flex items-center gap-5">
              <ProgressDonut percent={55} />
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2 text-text-secondary">
                  <span className="h-2.5 w-2.5 rounded-full bg-teal" /> Completed 2
                </li>
                <li className="flex items-center gap-2 text-text-secondary">
                  <span className="h-2.5 w-2.5 rounded-full bg-orange" /> In Progress 1
                </li>
                <li className="flex items-center gap-2 text-text-secondary">
                  <span className="h-2.5 w-2.5 rounded-full bg-border" /> Pending 3
                </li>
              </ul>
            </div>
            <p className="mt-3 text-xs text-text-secondary">Total Steps 6</p>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
