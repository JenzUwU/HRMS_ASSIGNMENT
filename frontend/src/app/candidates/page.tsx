"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  TableCellsIcon,
} from "@heroicons/react/24/solid";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { RiskBadge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ApiError } from "@/lib/api-client";
import {
  getCandidates,
  getRecruiters,
  type CandidateListItem,
  type CandidateListParams,
  type Recruiter,
} from "@/lib/api";
import {
  formatDate,
  joiningMonthLabel,
  relativeDays,
  riskLabel,
  stageLabel,
  CHANNEL_LABEL,
} from "@/lib/format";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

interface Filters {
  joining_month: string;
  recruiter_id: string;
  role: string;
  risk_level: string;
  status: string;
}

const EMPTY_FILTERS: Filters = {
  joining_month: "",
  recruiter_id: "",
  role: "",
  risk_level: "",
  status: "",
};

export default function CandidatesPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [rows, setRows] = useState<CandidateListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // filter option lists derived once from the full dataset
  const [recruiters, setRecruiters] = useState<Recruiter[]>([]);
  const [roleOptions, setRoleOptions] = useState<string[]>([]);
  const [monthOptions, setMonthOptions] = useState<string[]>([]);

  const reqId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // load filter option lists once
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // page_size 100 is the backend maximum and covers the full dataset.
        const [recs, all] = await Promise.all([
          getRecruiters(),
          getCandidates({ page: 1, page_size: 100 }),
        ]);
        if (!active) return;
        setRecruiters(recs);
        setRoleOptions(
          Array.from(new Set(all.items.map((c) => c.role))).sort(),
        );
        setMonthOptions(
          Array.from(
            new Set(all.items.map((c) => c.joining_date.slice(0, 7))),
          ).sort(),
        );
      } catch {
        // option lists are a convenience; the table still works without them
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    const params: CandidateListParams = {
      page,
      page_size: pageSize,
      search: debouncedSearch || undefined,
      joining_month: filters.joining_month || undefined,
      recruiter_id: filters.recruiter_id || undefined,
      role: filters.role || undefined,
      risk_level: filters.risk_level || undefined,
      status: filters.status || undefined,
    };
    try {
      const res = await getCandidates(params);
      if (id !== reqId.current) return;
      setRows(res.items);
      setTotal(res.total);
    } catch (e) {
      if (id !== reqId.current) return;
      setRows([]);
      setTotal(0);
      setError(
        e instanceof ApiError
          ? `Could not load candidates (${e.status}). ${e.message}`
          : "Could not reach the API. Check that the backend is running on port 8000.",
      );
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, filters]);

  useEffect(() => {
    // Imperative fetch when filters, search, or page change. The setState calls
    // inside load() are the intended effect of a dependency change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const activeFilterCount = useMemo(
    () =>
      Object.values(filters).filter(Boolean).length + (debouncedSearch ? 1 : 0),
    [filters, debouncedSearch],
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  function setFilter<K extends keyof Filters>(key: K, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  }

  function changeSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function changePageSize(value: number) {
    setPageSize(value);
    setPage(1);
  }

  return (
    <AppShell
      title="Candidates"
      searchPlaceholder="Search candidates by name, email or ID..."
    >
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
          <label className="min-w-[150px] flex-1">
            <span className="text-xs font-semibold text-text-secondary">
              Joining Month
            </span>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm">
              <CalendarDaysIcon className="h-4 w-4 text-text-secondary" />
              <select
                className="w-full bg-transparent outline-none"
                value={filters.joining_month}
                onChange={(e) => setFilter("joining_month", e.target.value)}
              >
                <option value="">All</option>
                {monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {joiningMonthLabel(m)}
                  </option>
                ))}
              </select>
            </div>
          </label>

          <label className="min-w-[150px] flex-1">
            <span className="text-xs font-semibold text-text-secondary">
              Recruiter
            </span>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm">
              <select
                className="w-full bg-transparent outline-none"
                value={filters.recruiter_id}
                onChange={(e) => setFilter("recruiter_id", e.target.value)}
              >
                <option value="">All</option>
                {recruiters.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.full_name}
                  </option>
                ))}
              </select>
            </div>
          </label>

          <label className="min-w-[150px] flex-1">
            <span className="text-xs font-semibold text-text-secondary">Role</span>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm">
              <select
                className="w-full bg-transparent outline-none"
                value={filters.role}
                onChange={(e) => setFilter("role", e.target.value)}
              >
                <option value="">All</option>
                {roleOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </label>

          <label className="min-w-[150px] flex-1">
            <span className="text-xs font-semibold text-text-secondary">
              Risk Level
            </span>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm">
              <select
                className="w-full bg-transparent outline-none"
                value={filters.risk_level}
                onChange={(e) => setFilter("risk_level", e.target.value)}
              >
                <option value="">All</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </label>

          <label className="min-w-[150px] flex-1">
            <span className="text-xs font-semibold text-text-secondary">
              Engagement Status
            </span>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm">
              <select
                className="w-full bg-transparent outline-none"
                value={filters.status}
                onChange={(e) => setFilter("status", e.target.value)}
              >
                <option value="">All</option>
                <option value="offer_accepted">Offer Accepted</option>
                <option value="active">Active</option>
                <option value="joined">Joined</option>
                <option value="declined">Declined</option>
              </select>
            </div>
          </label>

          <button
            onClick={clearFilters}
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
              {loading && rows.length === 0 ? "..." : total}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-text-secondary">
              <MagnifyingGlassIcon className="h-4 w-4" />
              <input
                value={search}
                onChange={(e) => changeSearch(e.target.value)}
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
              {loading &&
                Array.from({ length: Math.min(pageSize, 8) }).map((_, i) => (
                  <tr key={`sk-${i}`} className="border-b border-border">
                    {Array.from({ length: 11 }).map((__, j) => (
                      <td key={j} className="px-3 py-4">
                        <div className="h-3 w-full max-w-[120px] animate-pulse rounded bg-border" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!loading &&
                rows.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-border hover:bg-cream/50"
                  >
                    <td className="px-5 py-4">
                      <Link
                        href={`/candidates/${c.slug}`}
                        className="flex items-center gap-3"
                      >
                        <Avatar initials={c.initials} size="sm" tone="peach" />
                        <span>
                          <span className="block font-semibold text-charcoal hover:text-orange">
                            {c.full_name}
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
                        <Avatar initials={c.recruiter_initials} size="sm" />
                        {c.recruiter_name}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-text-secondary">
                      {c.location_city ?? c.location.split(",")[0]}
                    </td>
                    <td className="px-3 py-4 text-text-secondary">
                      {formatDate(c.offer_date)}
                    </td>
                    <td className="px-3 py-4 text-text-secondary">
                      {formatDate(c.joining_date)}
                    </td>
                    <td className="px-3 py-4">
                      <span className="mb-1 block text-xs font-medium text-charcoal">
                        {stageLabel(c.current_stage)}{" "}
                        <span className="text-text-secondary">
                          {c.steps_completed}/{c.steps_total}
                        </span>
                      </span>
                      <ProgressBar
                        value={c.steps_completed}
                        max={c.steps_total}
                        tone={
                          c.risk_level === "high"
                            ? "coral"
                            : c.risk_level === "medium"
                              ? "amber"
                              : "teal"
                        }
                        className="w-28"
                      />
                    </td>
                    <td className="px-3 py-4 text-text-secondary">
                      <span className="block">
                        {relativeDays(c.days_since_interaction)}
                      </span>
                      <span className="block text-xs">
                        {c.last_interaction_channel
                          ? CHANNEL_LABEL[c.last_interaction_channel]
                          : ""}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <RiskBadge level={riskLabel(c.risk_level)} />
                    </td>
                    <td className="px-3 py-4 text-text-secondary">
                      {c.next_action ?? ""}
                    </td>
                    <td className="px-3 py-4 text-right">
                      <EllipsisVerticalIcon className="h-4 w-4 text-text-secondary" />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          {!loading && error && (
            <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-coral/12 text-coral">
                <ExclamationTriangleIcon className="h-5 w-5" />
              </span>
              <p className="text-sm font-semibold text-charcoal">
                {error}
              </p>
              <button
                onClick={load}
                className="rounded-xl bg-orange px-4 py-2 text-sm font-semibold text-white hover:bg-orange/90"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && rows.length === 0 && (
            <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
              <p className="text-sm font-semibold text-charcoal">
                No candidates match these filters
              </p>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 text-sm font-semibold text-orange"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm text-text-secondary">
          <span>
            {total === 0
              ? "No candidates"
              : `Showing ${from} to ${to} of ${total} candidates`}
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border disabled:opacity-40"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            {pageWindow(page, totalPages).map((p, i) =>
              p === "gap" ? (
                <span key={`gap-${i}`} className="px-1">
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={
                    p === page
                      ? "flex h-8 w-8 items-center justify-center rounded-lg border border-orange bg-orange text-white"
                      : "flex h-8 w-8 items-center justify-center rounded-lg border border-border"
                  }
                >
                  {p}
                </button>
              ),
            )}
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border disabled:opacity-40"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5">
            <AdjustmentsHorizontalIcon className="h-4 w-4" />
            <select
              value={pageSize}
              onChange={(e) => changePageSize(Number(e.target.value))}
              className="bg-transparent outline-none"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>
    </AppShell>
  );
}

/** Compact page number window: 1 ... p-1 p p+1 ... last */
function pageWindow(page: number, totalPages: number): (number | "gap")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const out: (number | "gap")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) out.push("gap");
  for (let p = start; p <= end; p++) out.push(p);
  if (end < totalPages - 1) out.push("gap");
  out.push(totalPages);
  return out;
}
