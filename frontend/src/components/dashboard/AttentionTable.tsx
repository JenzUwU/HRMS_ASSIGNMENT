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
import { toast } from "@/lib/toast";
import { mutationErrorMessage } from "@/lib/ai-error";
import {
  createCandidateNote,
  getRiskHistory,
  patchRiskAssessment,
  type CandidateListItem,
} from "@/lib/api";

const EMPTY = (
  <p className="py-6 text-center text-sm text-text-secondary">
    No high-risk candidates right now.
  </p>
);

export function AttentionTable({ items }: { items: CandidateListItem[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(items);
  const [noteCounts, setNoteCounts] = useState<Record<string, number>>({});
  const [noteFor, setNoteFor] = useState<CandidateListItem | null>(null);
  const [resolveFor, setResolveFor] = useState<CandidateListItem | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialogErr, setDialogErr] = useState<string | null>(null);

  useEffect(() => {
    // Re-sync when the server component re-renders after router.refresh().
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(items);
  }, [items]);

  if (rows.length === 0) return EMPTY;

  async function saveNote() {
    const text = draft.trim();
    if (!text || !noteFor || busy) return;
    setBusy(true);
    setDialogErr(null);
    try {
      await createCandidateNote(noteFor.slug, { body: text });
      setNoteCounts((n) => ({
        ...n,
        [noteFor.slug]: (n[noteFor.slug] ?? 0) + 1,
      }));
      setDraft("");
      setNoteFor(null);
      toast("Note saved", "success");
      router.refresh();
    } catch (e) {
      setDialogErr(mutationErrorMessage(e, "Could not save the note."));
    } finally {
      setBusy(false);
    }
  }

  async function confirmResolve() {
    if (!resolveFor || busy) return;
    const reason = draft.trim();
    if (!reason) {
      setDialogErr("A short reason is required.");
      return;
    }
    setBusy(true);
    setDialogErr(null);
    try {
      const history = await getRiskHistory(resolveFor.slug);
      const current = history.find((h) => h.is_current);
      if (!current) throw new Error("no current risk assessment");
      await patchRiskAssessment(current.id, { level: "medium", reason });
      setRows((r) => r.filter((x) => x.id !== resolveFor.id));
      setResolveFor(null);
      setDraft("");
      toast("Risk lowered to Medium and logged", "success");
      router.refresh();
    } catch (e) {
      setDialogErr(
        mutationErrorMessage(e, "Could not update the risk assessment."),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] table-fixed text-sm">
          <colgroup>
            <col className="w-[26%]" />
            <col className="w-[13%]" />
            <col className="w-[13%]" />
            <col className="w-[12%]" />
            <col />
            <col className="w-[44px]" />
          </colgroup>
          <thead>
            <tr className="text-left align-bottom text-xs font-semibold uppercase tracking-wide text-text-secondary">
              <th className="pb-3 pr-4">Candidate</th>
              <th className="whitespace-nowrap pb-3 pr-4">Joining Date</th>
              <th className="whitespace-nowrap pb-3 pr-4">Last Interaction</th>
              <th className="whitespace-nowrap pb-3 pr-4">Risk Level</th>
              <th className="pb-3 pr-4">Recommended Next Action</th>
              <th className="pb-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const noteCount = noteCounts[c.slug] ?? 0;
              return (
                <tr
                  key={c.id}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("[data-row-actions]"))
                      return;
                    router.push(`/candidates/${c.slug}`);
                  }}
                  className="group/row cursor-pointer border-t border-border align-top transition-colors hover:bg-orange/[0.04]"
                >
                  <td className="py-3 pr-4">
                    <Link
                      href={`/candidates/${c.slug}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 font-semibold text-charcoal transition-colors group-hover/row:text-orange"
                    >
                      <Avatar
                        initials={c.initials}
                        size="sm"
                        tone="peach"
                        className="shrink-0 transition duration-200 group-hover/row:-translate-y-px group-hover/row:brightness-105"
                      />
                      <span className="truncate">{c.full_name}</span>
                    </Link>
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 text-text-secondary">
                    {formatDate(c.joining_date)}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 text-text-secondary">
                    {relativeDays(c.days_since_interaction)}
                  </td>
                  <td className="py-3 pr-4">
                    <RiskBadge level={riskLabel(c.risk_level)} />
                  </td>
                  <td className="py-3 pr-4 text-text-secondary">
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
                        setDialogErr(null);
                        setNoteFor(c);
                      }}
                      onResolve={() => {
                        setDraft("");
                        setDialogErr(null);
                        setResolveFor(c);
                      }}
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
          title={`Add note: ${noteFor.full_name}`}
          onClose={() => {
            setNoteFor(null);
            setDialogErr(null);
          }}
        >
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            placeholder="Internal note visible to HR only…"
            className="w-full resize-none rounded-xl border border-border bg-white/70 px-3 py-2.5 text-sm text-charcoal outline-none placeholder:text-text-secondary focus:border-orange"
          />
          {dialogErr && (
            <p className="mt-2 text-sm text-coral">{dialogErr}</p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setNoteFor(null);
                setDialogErr(null);
              }}
              className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-charcoal hover:bg-cream"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveNote}
              disabled={!draft.trim() || busy}
              className="rounded-xl bg-orange px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange/90 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save Note"}
            </button>
          </div>
        </Dialog>
      )}

      {resolveFor && (
        <Dialog
          title="Mark attention resolved?"
          onClose={() => {
            setResolveFor(null);
            setDialogErr(null);
          }}
        >
          <p className="text-sm text-text-secondary">
            This records an HR risk override for{" "}
            <strong className="text-charcoal">{resolveFor.full_name}</strong>:
            the engagement risk is lowered to <strong>Medium</strong> with your
            reason, and the original AI assessment is kept in history.
          </p>
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="Why is this no longer high risk? (required)"
            className="mt-3 w-full resize-none rounded-xl border border-border bg-white/70 px-3 py-2.5 text-sm text-charcoal outline-none placeholder:text-text-secondary focus:border-orange"
          />
          {dialogErr && (
            <p className="mt-2 text-sm text-coral">{dialogErr}</p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setResolveFor(null);
                setDialogErr(null);
              }}
              className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-charcoal hover:bg-cream"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmResolve}
              disabled={!draft.trim() || busy}
              className="rounded-xl bg-coral px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-coral/90 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Lower Risk & Resolve"}
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
