"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowPathIcon,
  ArrowsUpDownIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  TableCellsIcon,
} from "@heroicons/react/24/solid";
import { AppShell } from "@/components/layout/AppShell";
import { GlassIcon } from "@/components/ui/GlassIcon";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { RiskBadge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Dropdown } from "@/components/ui/Dropdown";
import { CandidateActionMenu } from "@/components/dashboard/CandidateActionMenu";
import { ApiError } from "@/lib/api-client";
import { downloadXls } from "@/lib/export-xls";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/cn";
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

const PAGE_SIZE_OPTIONS = [10, 25, 50];

type ColKey =
  | "candidate"
  | "role"
  | "recruiter"
  | "location"
  | "offer_date"
  | "joining_date"
  | "status"
  | "last_interaction"
  | "risk"
  | "next_action";

const COLUMNS: { key: ColKey; label: string; locked?: boolean }[] = [
  { key: "candidate", label: "Candidate", locked: true },
  { key: "role", label: "Role" },
  { key: "recruiter", label: "Recruiter" },
  { key: "location", label: "Location" },
  { key: "offer_date", label: "Offer Date" },
  { key: "joining_date", label: "Joining Date" },
  { key: "status", label: "Engagement Status" },
  { key: "last_interaction", label: "Last Interaction" },
  { key: "risk", label: "Risk Level" },
  { key: "next_action", label: "Next Action" },
];

const SORTS = [
  { key: "name-asc", label: "Candidate name A–Z" },
  { key: "name-desc", label: "Candidate name Z–A" },
  { key: "join-asc", label: "Joining date — earliest" },
  { key: "join-desc", label: "Joining date — latest" },
  { key: "risk", label: "Risk level (high first)" },
  { key: "score", label: "Engagement score" },
  { key: "interaction", label: "Last interaction" },
  { key: "offer", label: "Offer date — newest" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

const riskRank = (l: string) => (l === "high" ? 3 : l === "medium" ? 2 : 1);

function applySort(rows: CandidateListItem[], key: SortKey | null) {
  if (!key) return rows;
  const r = [...rows];
  const cmp: Record<SortKey, (a: CandidateListItem, b: CandidateListItem) => number> =
    {
      "name-asc": (a, b) => a.full_name.localeCompare(b.full_name),
      "name-desc": (a, b) => b.full_name.localeCompare(a.full_name),
      "join-asc": (a, b) => a.joining_date.localeCompare(b.joining_date),
      "join-desc": (a, b) => b.joining_date.localeCompare(a.joining_date),
      risk: (a, b) => riskRank(b.risk_level) - riskRank(a.risk_level),
      score: (a, b) => (b.engagement_score ?? 0) - (a.engagement_score ?? 0),
      interaction: (a, b) =>
        (a.days_since_interaction ?? 1e9) - (b.days_since_interaction ?? 1e9),
      offer: (a, b) => b.offer_date.localeCompare(a.offer_date),
    };
  return r.sort(cmp[key]);
}

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
  const [sort, setSort] = useState<SortKey | null>(null);
  const [hiddenCols, setHiddenCols] = useState<Set<ColKey>>(new Set());
  const [exporting, setExporting] = useState(false);

  const [rows, setRows] = useState<CandidateListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // filter option lists derived once from the full dataset
  const [recruiters, setRecruiters] = useState<Recruiter[]>([]);
  const [roleOptions, setRoleOptions] = useState<string[]>([]);
  const [monthOptions, setMonthOptions] = useState<string[]>([]);

  const reqId = useRef(0);

  // Deep links from Analytics / notifications: ?recruiter=&role=&risk=&status=&month=
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const next: Partial<Filters> = {};
    if (q.get("recruiter")) next.recruiter_id = q.get("recruiter") as string;
    if (q.get("role")) next.role = q.get("role") as string;
    if (q.get("risk")) next.risk_level = q.get("risk") as string;
    if (q.get("status")) next.status = q.get("status") as string;
    if (q.get("month")) next.joining_month = q.get("month") as string;
    if (Object.keys(next).length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFilters((f) => ({ ...f, ...next }));
    }
  }, []);

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

  const activeFilterCount = useMemo(
    () =>
      Object.values(filters).filter(Boolean).length + (debouncedSearch ? 1 : 0),
    [filters, debouncedSearch],
  );

  const filterParams = useCallback(
    (): Omit<CandidateListParams, "page" | "page_size"> => ({
      search: debouncedSearch || undefined,
      joining_month: filters.joining_month || undefined,
      recruiter_id: filters.recruiter_id || undefined,
      role: filters.role || undefined,
      risk_level: filters.risk_level || undefined,
      status: filters.status || undefined,
    }),
    [debouncedSearch, filters],
  );

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    const params: CandidateListParams = {
      page,
      page_size: pageSize,
      ...filterParams(),
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
  }, [page, pageSize, filterParams]);

  const displayRows = useMemo(() => applySort(rows, sort), [rows, sort]);
  const showCol = (k: ColKey) => !hiddenCols.has(k);

  function toggleCol(k: ColKey) {
    setHiddenCols((cur) => {
      const next = new Set(cur);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await getCandidates({
        page: 1,
        page_size: 100,
        ...filterParams(),
      });
      const headers = [
        "Name",
        "Email",
        "Role",
        "Recruiter",
        "Location",
        "Offer Date",
        "Joining Date",
        "Status",
        "Stage",
        "Risk",
        "Engagement Score",
        "Days Since Interaction",
        "Next Action",
      ];
      const data = applySort(res.items, sort).map((c) => [
        c.full_name,
        c.email,
        c.role,
        c.recruiter_name,
        c.location,
        c.offer_date,
        c.joining_date,
        c.status,
        c.current_stage,
        c.risk_level,
        c.engagement_score ?? "",
        c.days_since_interaction ?? "",
        c.next_action ?? "",
      ]);
      downloadXls(
        `candidates-${new Date().toISOString().slice(0, 10)}`,
        headers,
        data,
      );
      toast(
        `Exported ${data.length} candidate${data.length === 1 ? "" : "s"}${
          activeFilterCount > 0 ? " (filtered)" : ""
        }`,
        "success",
      );
    } catch {
      toast("Export failed — check the API is running", "error");
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    // Imperative fetch when filters, search, or page change. The setState calls
    // inside load() are the intended effect of a dependency change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

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
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="group flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-charcoal transition-all duration-150 hover:-translate-y-px hover:border-orange/40 hover:bg-cream hover:shadow-[0_8px_20px_-10px_rgba(252,128,25,0.3)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {exporting ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-charcoal/40 border-t-transparent" />
          ) : (
            <GlassIcon
              name="download"
              size={16}
              className="transition-transform duration-200 group-hover:translate-y-0.5"
            />
          )}
          {exporting ? "Exporting…" : "Export"}
        </button>
      </div>

      <Card className="mb-5">
        <div className="flex flex-wrap items-end gap-4">
          <label className="min-w-[150px] flex-1">
            <span className="text-xs font-semibold text-text-secondary">
              Joining Month
            </span>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm transition-colors hover:border-orange/40 focus-within:border-orange focus-within:ring-2 focus-within:ring-orange/15">
              <GlassIcon name="leave" size={16} />
              <select
                className="w-full cursor-pointer bg-transparent outline-none"
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
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm transition-colors hover:border-orange/40 focus-within:border-orange focus-within:ring-2 focus-within:ring-orange/15">
              <select
                className="w-full cursor-pointer bg-transparent outline-none"
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
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm transition-colors hover:border-orange/40 focus-within:border-orange focus-within:ring-2 focus-within:ring-orange/15">
              <select
                className="w-full cursor-pointer bg-transparent outline-none"
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
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm transition-colors hover:border-orange/40 focus-within:border-orange focus-within:ring-2 focus-within:ring-orange/15">
              <select
                className="w-full cursor-pointer bg-transparent outline-none"
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
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm transition-colors hover:border-orange/40 focus-within:border-orange focus-within:ring-2 focus-within:ring-orange/15">
              <select
                className="w-full cursor-pointer bg-transparent outline-none"
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
            type="button"
            onClick={clearFilters}
            disabled={activeFilterCount === 0}
            className="group flex items-center gap-1.5 rounded-xl px-2 py-2.5 text-sm font-semibold text-orange transition-colors hover:bg-peach/40 disabled:cursor-not-allowed disabled:text-text-secondary"
          >
            <ArrowPathIcon className="h-4 w-4 transition-transform duration-300 group-hover:-rotate-180" />
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
            <div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-text-secondary transition-colors hover:border-orange/40 focus-within:border-orange focus-within:ring-2 focus-within:ring-orange/15">
              <GlassIcon name="search" size={16} />
              <input
                value={search}
                onChange={(e) => changeSearch(e.target.value)}
                placeholder="Search in table..."
                aria-label="Search in table"
                className="w-40 bg-transparent text-charcoal outline-none"
              />
            </div>

            <Dropdown
              label="Columns"
              icon={<TableCellsIcon className="h-4 w-4" />}
              active={hiddenCols.size > 0}
            >
              {() => (
                <>
                  <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                    Visible columns
                  </p>
                  {COLUMNS.map((col) => {
                    const on = showCol(col.key);
                    return (
                      <button
                        key={col.key}
                        type="button"
                        disabled={col.locked}
                        onClick={() => toggleCol(col.key)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-charcoal transition-colors hover:bg-peach/50 disabled:opacity-60 disabled:hover:bg-transparent"
                      >
                        <span
                          className={cn(
                            "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                            on
                              ? "border-orange bg-orange text-white"
                              : "border-border",
                          )}
                        >
                          {on && <CheckIcon className="h-3 w-3" />}
                        </span>
                        {col.label}
                      </button>
                    );
                  })}
                </>
              )}
            </Dropdown>

            <Dropdown
              label="Sort"
              icon={<ArrowsUpDownIcon className="h-4 w-4" />}
              active={sort !== null}
            >
              {(close) => (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setSort(null);
                      close();
                    }}
                    className={cn(
                      "flex w-full items-center rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors hover:bg-peach/50",
                      sort === null ? "text-orange" : "text-charcoal",
                    )}
                  >
                    Default order
                  </button>
                  <div className="my-1 h-px bg-black/[0.06]" />
                  {SORTS.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => {
                        setSort(s.key);
                        close();
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors hover:bg-peach/50",
                        sort === s.key ? "text-orange" : "text-charcoal",
                      )}
                    >
                      {s.label}
                      {sort === s.key && <CheckIcon className="h-3.5 w-3.5" />}
                    </button>
                  ))}
                </>
              )}
            </Dropdown>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-y border-border text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                <th className="px-5 py-3">Candidate</th>
                {showCol("role") && <th className="px-3 py-3">Role</th>}
                {showCol("recruiter") && (
                  <th className="px-3 py-3">Recruiter</th>
                )}
                {showCol("location") && (
                  <th className="px-3 py-3">Location</th>
                )}
                {showCol("offer_date") && (
                  <th className="px-3 py-3">Offer Date</th>
                )}
                {showCol("joining_date") && (
                  <th className="px-3 py-3">Joining Date</th>
                )}
                {showCol("status") && (
                  <th className="px-3 py-3">Engagement Status</th>
                )}
                {showCol("last_interaction") && (
                  <th className="px-3 py-3">Last Interaction</th>
                )}
                {showCol("risk") && (
                  <th className="px-3 py-3">Risk Level</th>
                )}
                {showCol("next_action") && (
                  <th className="px-3 py-3">Next Action</th>
                )}
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
                displayRows.map((c) => (
                  <tr
                    key={c.id}
                    className="group/row border-b border-border transition-colors hover:bg-peach/20"
                  >
                    <td className="px-5 py-4">
                      <Link
                        href={`/candidates/${c.slug}`}
                        className="flex items-center gap-3"
                      >
                        <Avatar
                          initials={c.initials}
                          size="sm"
                          tone="peach"
                          className="transition-transform duration-200 group-hover/row:-translate-y-px group-hover/row:brightness-105"
                        />
                        <span>
                          <span className="block font-semibold text-charcoal transition-colors group-hover/row:text-orange">
                            {c.full_name}
                          </span>
                          <span className="block text-xs text-text-secondary">
                            {c.email}
                          </span>
                        </span>
                      </Link>
                    </td>
                    {showCol("role") && (
                      <td className="px-3 py-4 text-text-secondary">{c.role}</td>
                    )}
                    {showCol("recruiter") && (
                      <td className="px-3 py-4">
                        <span className="flex items-center gap-2 text-text-secondary">
                          <Avatar
                            initials={c.recruiter_initials}
                            size="sm"
                          />
                          {c.recruiter_name}
                        </span>
                      </td>
                    )}
                    {showCol("location") && (
                      <td className="px-3 py-4 text-text-secondary">
                        {c.location_city ?? c.location.split(",")[0]}
                      </td>
                    )}
                    {showCol("offer_date") && (
                      <td className="px-3 py-4 text-text-secondary">
                        {formatDate(c.offer_date)}
                      </td>
                    )}
                    {showCol("joining_date") && (
                      <td className="px-3 py-4 text-text-secondary">
                        {formatDate(c.joining_date)}
                      </td>
                    )}
                    {showCol("status") && (
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
                    )}
                    {showCol("last_interaction") && (
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
                    )}
                    {showCol("risk") && (
                      <td className="px-3 py-4">
                        <RiskBadge level={riskLabel(c.risk_level)} />
                      </td>
                    )}
                    {showCol("next_action") && (
                      <td className="px-3 py-4 text-text-secondary">
                        {c.next_action ?? ""}
                      </td>
                    )}
                    <td className="px-3 py-4 text-right">
                      <CandidateActionMenu slug={c.slug} />
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
              type="button"
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors hover:border-orange/50 hover:bg-peach/40 active:scale-95 disabled:opacity-40 disabled:hover:border-border disabled:hover:bg-transparent"
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
                  type="button"
                  aria-current={p === page ? "page" : undefined}
                  onClick={() => setPage(p)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-semibold transition-all duration-150 active:scale-95",
                    p === page
                      ? "border-orange bg-orange text-white shadow-[0_4px_12px_-4px_rgba(252,128,25,0.5)]"
                      : "border-border text-charcoal hover:border-orange/50 hover:bg-peach/40",
                  )}
                >
                  {p}
                </button>
              ),
            )}
            <button
              type="button"
              aria-label="Next page"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors hover:border-orange/50 hover:bg-peach/40 active:scale-95 disabled:opacity-40 disabled:hover:border-border disabled:hover:bg-transparent"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 transition-colors hover:border-orange/40">
            <GlassIcon name="filters" size={16} />
            <select
              value={pageSize}
              onChange={(e) => changePageSize(Number(e.target.value))}
              aria-label="Rows per page"
              className="cursor-pointer bg-transparent outline-none"
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
