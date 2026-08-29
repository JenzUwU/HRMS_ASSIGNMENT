"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GlassIcon } from "@/components/ui/GlassIcon";
import { Avatar } from "@/components/ui/Avatar";
import { getCandidates, type CandidateListItem } from "@/lib/api";
import { cn } from "@/lib/cn";

/**
 * Global candidate search in the top bar. Loads the candidate list once
 * (existing API, page_size 100 covers the mock dataset) and matches partially
 * on name / email / role / recruiter. Selecting a result navigates to that
 * candidate's details page.
 */
export function GlobalSearch({ placeholder }: { placeholder?: string }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [all, setAll] = useState<CandidateListItem[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let alive = true;
    getCandidates({ page: 1, page_size: 100 })
      .then((r) => {
        if (alive) setAll(r.items);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return all
      .filter(
        (c) =>
          c.full_name.toLowerCase().includes(t) ||
          c.email.toLowerCase().includes(t) ||
          c.role.toLowerCase().includes(t) ||
          c.recruiter_name.toLowerCase().includes(t),
      )
      .slice(0, 6);
  }, [q, all]);

  function goto(c: CandidateListItem) {
    setOpen(false);
    setQ("");
    router.push(`/candidates/${c.slug}`);
  }

  return (
    <div
      ref={ref}
      className="relative mx-auto hidden w-full max-w-xl md:block"
    >
      <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 text-sm text-text-secondary transition-colors focus-within:border-orange/50 focus-within:ring-2 focus-within:ring-orange/15">
        <GlassIcon name="search" size={18} />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown")
              setActive((i) => Math.min(i + 1, results.length - 1));
            else if (e.key === "ArrowUp") setActive((i) => Math.max(i - 1, 0));
            else if (e.key === "Enter" && results[active]) goto(results[active]);
          }}
          placeholder={placeholder ?? "Search candidates by name, email or role..."}
          aria-label="Search candidates"
          className="w-full bg-transparent text-charcoal outline-none placeholder:text-text-secondary"
        />
      </div>

      {open && q.trim() && (
        <div
          role="listbox"
          className={cn(
            "animate-menu-in absolute left-0 right-0 top-full z-40 mt-2 rounded-xl p-1.5",
            "border border-white/70 bg-white/90 ring-1 ring-black/5",
            "shadow-[0_18px_44px_-12px_rgba(203,110,40,0.22)] backdrop-blur-xl backdrop-saturate-150",
          )}
        >
          {results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-text-secondary">
              No candidates match &ldquo;{q.trim()}&rdquo;.
            </p>
          ) : (
            results.map((c, i) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => goto(c)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                  i === active ? "bg-peach/50" : "hover:bg-peach/40",
                )}
              >
                <Avatar initials={c.initials} size="sm" tone="peach" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-charcoal">
                    {c.full_name}
                  </span>
                  <span className="block truncate text-xs text-text-secondary">
                    {c.role} &middot; {c.email}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
