"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { XMarkIcon } from "@heroicons/react/24/solid";
import { Avatar } from "@/components/ui/Avatar";
import { RiskBadge } from "@/components/ui/Badge";
import { CandidateActionMenu } from "@/components/dashboard/CandidateActionMenu";
import { formatDate, relativeDays, riskLabel } from "@/lib/format";
import type { CandidateListItem } from "@/lib/api";

const EMPTY = (
  <p className="py-6 text-center text-sm text-text-secondary">
    No high-risk candidates right now.
  </p>
);

export function AttentionTable({ items }: { items: CandidateListItem[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(items);
  // Internal HR notes — mock only, kept in local state (no backend).
  const [notes, setNotes] = useState<Record<string, string[]>>({});
  const [noteFor, setNoteFor] = useState<CandidateListItem | null>(null);
  const [resolveFor, setResolveFor] = useState<CandidateListItem | null>(null);
  const [draft, setDraft] = useState("");

  if (rows.length === 0) return EMPTY;

  function saveNote() {
    const text = draft.trim();
    if (!text || !noteFor) return;
    const slug = noteFor.slug;
    setNotes((n) => ({ ...n, [slug]: [...(n[slug] ?? []), text] }));
    setDraft("");
    setNoteFor(null);
  }

  function confirmResolve() {
    if (!resolveFor) return;
    setRows((r) => r.filter((x) => x.id !== resolveFor.id));
    setResolveFor(null);
  }

  return (
    <>
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
            {rows.map((c) => {
              const noteCount = notes[c.slug]?.length ?? 0;
              return (
                <tr
                  key={c.id}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("[data-row-actions]"))
                      return;
                    router.push(`/candidates/${c.slug}`);
                  }}
                  className="group/row cursor-pointer border-t border-border transition-colors hover:bg-orange/[0.04]"
                >
                  <td className="py-3">
                    <Link
                      href={`/candidates/${c.slug}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 font-semibold text-charcoal transition-colors group-hover/row:text-orange"
                    >
                      <Avatar
                        initials={c.initials}
                        size="sm"
                        tone="peach"
                        className="transition duration-200 group-hover/row:-translate-y-px group-hover/row:brightness-105"
                      />
                      {c.full_name}
                    </Link>
                  </td>
                  <td className="py-3 text-text-secondary">
                    {formatDate(c.joining_date)}
                  </td>
                  <td className="py-3 text-text-secondary">
                    {relativeDays(c.days_since_interaction)}
                  </td>
                  <td className="py-3">
                    <RiskBadge level={riskLabel(c.risk_level)} />
                  </td>
                  <td className="py-3 text-text-secondary">
                    {c.next_action ?? ""}
                    {noteCount > 0 && (
                      <span className="ml-2 rounded-full bg-orange/10 px-1.5 py-0.5 text-[10px] font-semibold text-orange">
                        {noteCount} note{noteCount === 1 ? "" : "s"}
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-right" data-row-actions>
                    <CandidateActionMenu
                      slug={c.slug}
                      onAddNote={() => {
                        setDraft("");
                        setNoteFor(c);
                      }}
                      onResolve={() => setResolveFor(c)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {noteFor && (
        <Dialog
          title={`Add note — ${noteFor.full_name}`}
          onClose={() => setNoteFor(null)}
        >
          {(notes[noteFor.slug]?.length ?? 0) > 0 && (
            <ul className="mb-3 space-y-2">
              {notes[noteFor.slug].map((n, i) => (
                <li
                  key={i}
                  className="rounded-xl bg-cream/70 px-3 py-2 text-sm text-charcoal"
                >
                  {n}
                </li>
              ))}
            </ul>
          )}
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            placeholder="Internal note visible to HR only…"
            className="w-full resize-none rounded-xl border border-border bg-white/70 px-3 py-2.5 text-sm text-charcoal outline-none placeholder:text-text-secondary focus:border-orange"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setNoteFor(null)}
              className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-charcoal hover:bg-cream"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveNote}
              disabled={!draft.trim()}
              className="rounded-xl bg-orange px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange/90 disabled:opacity-50"
            >
              Save Note
            </button>
          </div>
        </Dialog>
      )}

      {resolveFor && (
        <Dialog
          title="Mark as resolved?"
          onClose={() => setResolveFor(null)}
        >
          <p className="text-sm text-text-secondary">
            <strong className="text-charcoal">{resolveFor.full_name}</strong> will
            be removed from &ldquo;Candidates Needing Attention&rdquo;. This is a
            mock action and only affects this view.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setResolveFor(null)}
              className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-charcoal hover:bg-cream"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmResolve}
              className="rounded-xl bg-coral px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-coral/90"
            >
              Mark Resolved
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}

/** Small centered glass modal, matching the app surface treatment. */
function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/30 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-2xl border border-white/70 bg-white/90 p-5 shadow-[0_30px_70px_-20px_rgba(41,41,41,0.35)] ring-1 ring-black/5 backdrop-blur-xl backdrop-saturate-150 animate-[menuIn_140ms_ease-out]"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 className="font-heading text-base font-semibold text-charcoal">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-text-secondary transition-colors hover:bg-cream hover:text-charcoal"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
