import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BriefcaseIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  ChevronRightIcon,
  EllipsisVerticalIcon,
  EnvelopeIcon,
  IdentificationIcon,
  InformationCircleIcon,
  MapPinIcon,
  PencilSquareIcon,
  PhoneIcon,
  UserIcon,
} from "@heroicons/react/24/solid";
import { AppShell } from "@/components/layout/AppShell";
import { Card, SectionCard } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { RiskGauge } from "@/components/charts/RiskGauge";
import { JourneyStepper } from "@/components/charts/JourneyStepper";
import {
  JOURNEY_STAGES,
  getCandidate,
  journeyTimeline,
  pendingActions,
} from "@/lib/mock-data";

export default async function CandidateDetailsPage({
  params,
}: PageProps<"/candidates/[id]">) {
  const { id } = await params;
  const candidate = getCandidate(id);
  if (!candidate) notFound();

  const steps = JOURNEY_STAGES.map((stage, i) => ({
    label: stage.label,
    date:
      i === 0
        ? candidate.offerDate.replace(" 2025", "")
        : i <= candidate.stageIndex
          ? candidate.offerDate.replace(" 2025", "")
          : i === JOURNEY_STAGES.length - 1
            ? candidate.joiningDate.replace(" 2025", "")
            : "",
    status:
      i < candidate.stageIndex
        ? ("completed" as const)
        : i === candidate.stageIndex
          ? ("in_progress" as const)
          : ("pending" as const),
    statusLabel:
      i < candidate.stageIndex
        ? "Completed"
        : i === candidate.stageIndex
          ? "In Progress"
          : "Pending",
  }));

  const info = [
    { label: "Recruiter", value: candidate.recruiter, icon: UserIcon },
    { label: "Source", value: candidate.source, icon: IdentificationIcon },
    { label: "Department", value: candidate.department, icon: BuildingOffice2Icon },
    { label: "Employment Type", value: candidate.employmentType, icon: BriefcaseIcon },
    { label: "Location", value: candidate.location, icon: MapPinIcon },
  ];

  return (
    <AppShell title="Candidate Details">
      <div className="mb-5 flex items-center justify-between">
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/candidates" className="font-semibold text-orange">
            Candidates
          </Link>
          <ChevronRightIcon className="h-3.5 w-3.5 text-text-secondary" />
          <span className="font-semibold text-charcoal">{candidate.name}</span>
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
              <Avatar initials={candidate.initials} size="xl" tone="peach" online />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-heading text-2xl font-bold text-charcoal">
                    {candidate.name}
                  </h2>
                  <Badge tone="peach">{candidate.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-text-secondary">
                  {candidate.role}, {candidate.location.split(",")[0]}
                </p>
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-text-secondary">
                  <span className="flex items-center gap-1.5">
                    <EnvelopeIcon className="h-4 w-4" />
                    {candidate.email}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <PhoneIcon className="h-4 w-4" />
                    {candidate.phone}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-5 text-sm">
                  <span className="text-text-secondary">
                    Offered on:{" "}
                    <span className="font-semibold text-charcoal">
                      {candidate.offerDate}
                    </span>
                  </span>
                  <span className="text-text-secondary">
                    Joining on:{" "}
                    <span className="font-semibold text-charcoal">
                      {candidate.joiningDate} (in {candidate.joiningDaysLeft} days)
                    </span>
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button className="flex items-center justify-center gap-2 rounded-xl border border-orange px-4 py-2.5 text-sm font-semibold text-orange hover:bg-peach/40">
                  <EnvelopeIcon className="h-4 w-4" />
                  Send Message
                </button>
                <button className="flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-charcoal hover:bg-cream">
                  <EllipsisVerticalIcon className="h-4 w-4" />
                  More Actions
                </button>
              </div>
            </div>
          </Card>

          <SectionCard title="Engagement Journey" action="View Full Journey" actionHref="/engagement-journey">
            <JourneyStepper steps={steps} />
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-peach/40 px-4 py-3 text-sm">
              <span className="flex items-center gap-2 text-charcoal">
                <InformationCircleIcon className="h-4 w-4 text-orange" />
                Waiting for candidate to upload remaining documents.
              </span>
              <Link
                href="/engagement-journey"
                className="flex items-center gap-1 font-semibold text-orange"
              >
                View Documents
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </Link>
            </div>
          </SectionCard>

          <div className="grid gap-4 md:grid-cols-2">
            <SectionCard
              title="Recent Communications"
              action="View All"
              actionHref="/communication"
              footer={{ label: "Go to Communication", href: "/communication" }}
            >
              <ul className="space-y-4">
                {journeyTimeline.slice(0, 4).map((e) => (
                  <li key={e.id} className="flex gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-peach text-orange">
                      {e.id === "2" ? (
                        <ChatBubbleLeftRightIcon className="h-4 w-4" />
                      ) : (
                        <EnvelopeIcon className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-charcoal">
                        {e.title}
                      </p>
                      <p className="text-xs text-text-secondary">
                        Sent to {candidate.name}
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-xs text-text-secondary">
                      {e.date}
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard
              title="Upcoming / Pending Actions"
              action="View All"
              actionHref="/engagement-journey"
              footer={{ label: "Go to Engagement Journey", href: "/engagement-journey" }}
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
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <h3 className="font-heading text-base font-semibold text-charcoal">
              Engagement Risk
            </h3>
            <div className="mt-3 flex items-start justify-between">
              <div>
                <Badge tone="coral" dot>
                  {candidate.riskLevel} Risk
                </Badge>
                <p className="mt-4 text-sm text-text-secondary">Risk Score</p>
                <p className="font-heading text-3xl font-bold text-charcoal">
                  {candidate.riskScore}/100
                </p>
              </div>
              <RiskGauge score={candidate.riskScore} />
            </div>
            <p className="mt-3 text-sm text-text-secondary">
              Last interaction was {candidate.lastInteraction}. Consider reaching out.
            </p>
            <button className="mt-4 w-full rounded-xl border border-orange py-2.5 text-sm font-semibold text-orange hover:bg-peach/40">
              View Risk Insights
            </button>
          </Card>

          <Card>
            <h3 className="font-heading text-base font-semibold text-charcoal">
              Candidate Information
            </h3>
            <dl className="mt-4 space-y-3 text-sm">
              {info.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-text-secondary">
                    <row.icon className="h-4 w-4" />
                    {row.label}
                  </dt>
                  <dd className="text-right font-semibold text-charcoal">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
            <button className="mt-4 w-full rounded-xl border border-border py-2.5 text-sm font-semibold text-charcoal hover:bg-cream">
              View Full Profile
            </button>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-base font-semibold text-charcoal">
                HR Notes
              </h3>
              <button className="flex items-center gap-1 text-sm font-semibold text-orange">
                <PencilSquareIcon className="h-4 w-4" />
                Edit
              </button>
            </div>
            <div className="mt-3 rounded-xl bg-cream/70 p-4 text-sm text-text-secondary">
              <p>{candidate.hrNote}</p>
              <p className="mt-3 text-xs font-medium text-charcoal">
                {candidate.hrNoteBy}, {candidate.hrNoteDate}
              </p>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
