"use client";

import Link from "next/link";
import { GlassIcon } from "@/components/ui/GlassIcon";
import { Dropdown } from "@/components/ui/Dropdown";

/**
 * Analytics is aggregate data with no local filter state, so "Filter" is a
 * jump-off: pick a recruiter and land on the candidate list already filtered
 * (the candidates page reads ?recruiter=).
 */
export function AnalyticsFilter({
  recruiters,
}: {
  recruiters: { recruiter_id: string; recruiter_name: string }[];
}) {
  return (
    <Dropdown
      label="Filter"
      icon={<GlassIcon name="filters" size={16} />}
      panelClassName="max-h-72 overflow-y-auto"
    >
      {(close) => (
        <>
          <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
            View candidates by recruiter
          </p>
          <Link
            href="/candidates"
            onClick={close}
            className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-sm font-medium text-charcoal transition-colors hover:bg-peach/50 hover:text-orange"
          >
            All candidates
          </Link>
          {recruiters.map((r) => (
            <Link
              key={r.recruiter_id}
              href={`/candidates?recruiter=${r.recruiter_id}`}
              onClick={close}
              className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-sm font-medium text-charcoal transition-colors hover:bg-peach/50 hover:text-orange"
            >
              {r.recruiter_name}
            </Link>
          ))}
        </>
      )}
    </Dropdown>
  );
}
