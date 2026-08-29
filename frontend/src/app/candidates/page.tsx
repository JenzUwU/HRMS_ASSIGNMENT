"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AdjustmentsHorizontalIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowsUpDownIcon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EllipsisVerticalIcon,
  MagnifyingGlassIcon,
  TableCellsIcon,
} from "@heroicons/react/24/solid";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { RiskBadge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { candidates } from "@/lib/mock-data";
import type { RiskLevel } from "@/types";

const filters = [
  { label: "Joining Month", value: "May 2025", icon: true },
  { label: "Recruiter", value: "All" },
  { label: "Role", value: "All" },
  { label: "Risk Level", value: "All" },
  { label: "Engagement Status", value: "All" },
];

export default function CandidatesPage() {
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState<RiskLevel | "All">("All");

  const rows = useMemo(
    () =>
      candidates.filter((c) => {
        const matchQuery =
          !query ||
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.email.toLowerCase().includes(query.toLowerCase());
        const matchRisk = risk === "All" || c.riskLevel === risk;
        return matchQuery && matchRisk;
      }),
    [query, risk],
  );

  return (
    <AppShell title="Candidates" searchPlaceholder="Search candidates by name, email or ID...">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          Track and manage all offered candidates through their post-offer journey.
        </p>
        <button className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-charcoal hover:bg-cream">
          <ArrowDownTrayIcon className="h-4 w-4" />
          Export
        </button>
      </div>

      <Card className="mb-5">
        <div className="flex flex-wrap items-end gap-4">
          {filters.map((f) => (
            <label key={f.label} className="flex-1 min-w-[150px]">
              <span className="text-xs font-semibold text-text-secondary">
                {f.label}
              </span>
              <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm">
                {f.icon && (
                  <CalendarDaysIcon className="h-4 w-4 text-text-secondary" />
                )}
                <select
                  className="w-full bg-transparent outline-none"
                  value={f.label === "Risk Level" ? risk : f.value}
                  onChange={(e) =>
                    f.label === "Risk Level" &&
                    setRisk(e.target.value as RiskLevel | "All")
                  }
                >
                  {f.label === "Risk Level" ? (
                    <>
                      <option>All</option>
                      <option>High</option>
                      <option>Medium</option>
                      <option>Low</option>
                    </>
                  ) : (
                    <option>{f.value}</option>
                  )}
                </select>
              </div>
            </label>
          ))}
          <button
            onClick={() => {
              setRisk("All");
              setQuery("");
            }}
            className="flex items-center gap-1.5 py-2.5 text-sm font-semibold text-orange"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Clear Filters
          </button>
        </div>
      </Card>

      <Card className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
          <div>
            <p className="text-xs font-medium text-text-secondary">
              Total Candidates
            </p>
            <p className="font-heading text-2xl font-bold text-charcoal">
              {candidates.length}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-text-secondary">
              <MagnifyingGlassIcon className="h-4 w-4" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search in table..."
                className="w-40 bg-transparent outline-none"
              />
            </div>
            <button className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-charcoal">
              <TableCellsIcon className="h-4 w-4" />
              Columns
            </button>
            <button className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-charcoal">
              <ArrowsUpDownIcon className="h-4 w-4" />
              Sort
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-y border-border text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                <th className="px-5 py-3">Candidate</th>
                <th className="px-3 py-3">Role</th>
                <th className="px-3 py-3">Recruiter</th>
                <th className="px-3 py-3">Location</th>
                <th className="px-3 py-3">Offer Date</th>
                <th className="px-3 py-3">Joining Date</th>
                <th className="px-3 py-3">Engagement Status</th>
                <th className="px-3 py-3">Last Interaction</th>
                <th className="px-3 py-3">Risk Level</th>
                <th className="px-3 py-3">Next Action</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-border hover:bg-cream/50">
                  <td className="px-5 py-4">
                    <Link
                      href={`/candidates/${c.id}`}
                      className="flex items-center gap-3"
                    >
                      <Avatar initials={c.initials} size="sm" tone="peach" />
                      <span>
                        <span className="block font-semibold text-charcoal hover:text-orange">
                          {c.name}
                        </span>
                        <span className="block text-xs text-text-secondary">
                          {c.email}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-4 text-text-secondary">{c.role}</td>
                  <td className="px-3 py-4">
                    <span className="flex items-center gap-2 text-text-secondary">
                      <Avatar initials={c.recruiterInitials} size="sm" />
                      {c.recruiter}
                    </span>
                  </td>
                  <td className="px-3 py-4 text-text-secondary">{c.location.split(",")[0]}</td>
                  <td className="px-3 py-4 text-text-secondary">{c.offerDate}</td>
                  <td className="px-3 py-4 text-text-secondary">{c.joiningDate}</td>
                  <td className="px-3 py-4">
                    <span className="mb-1 block text-xs font-medium text-charcoal">
                      {c.stageLabel}{" "}
                      <span className="text-text-secondary">
                        {c.stageProgress}/5
                      </span>
                    </span>
                    <ProgressBar
                      value={c.stageProgress}
                      tone={
                        c.riskLevel === "High"
                          ? "coral"
                          : c.riskLevel === "Medium"
                            ? "amber"
                            : "teal"
                      }
                      className="w-28"
                    />
                  </td>
                  <td className="px-3 py-4 text-text-secondary">
                    <span className="block">{c.lastInteraction}</span>
                    <span className="block text-xs">{c.lastChannel}</span>
                  </td>
                  <td className="px-3 py-4">
                    <RiskBadge level={c.riskLevel} />
                  </td>
                  <td className="px-3 py-4 text-text-secondary">{c.nextAction}</td>
                  <td className="px-3 py-4 text-right">
                    <EllipsisVerticalIcon className="h-4 w-4 text-text-secondary" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm text-text-secondary">
          <span>
            Showing 1 to {rows.length} of {candidates.length} candidates
          </span>
          <div className="flex items-center gap-1">
            <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-border">
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            {[1, 2, 3].map((p) => (
              <button
                key={p}
                className={
                  p === 1
                    ? "flex h-8 w-8 items-center justify-center rounded-lg border border-orange bg-orange text-white"
                    : "flex h-8 w-8 items-center justify-center rounded-lg border border-border"
                }
              >
                {p}
              </button>
            ))}
            <span className="px-1">...</span>
            <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-border">
              31
            </button>
            <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-border">
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5">
            <AdjustmentsHorizontalIcon className="h-4 w-4" />
            10 / page
          </div>
        </div>
      </Card>
    </AppShell>
  );
}
