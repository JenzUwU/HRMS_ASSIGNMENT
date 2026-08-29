"use client";

import { useState } from "react";
import { PencilSquareIcon } from "@heroicons/react/24/solid";
import { Card } from "@/components/ui/Card";
import { toast } from "@/lib/toast";
import { mutationErrorMessage } from "@/lib/ai-error";
import { createCandidateNote, type CandidateNote } from "@/lib/api";
import { formatDate } from "@/lib/format";

export function HrNotesCard({
  slug,
  initialNote,
}: {
  slug: string;
  initialNote: CandidateNote | null;
}) {
  const [note, setNote] = useState<CandidateNote | null>(initialNote);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createCandidateNote(slug, { body });
      setNote(created);
      setDraft("");
      setOpen(false);
      toast("Note saved", "success");
    } catch (e) {
      setError(mutationErrorMessage(e, "Could not save the note."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-base font-semibold text-charcoal">
          HR Notes
        </h3>
        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            setError(null);
          }}
          className="flex items-center gap-1 text-sm font-semibold text-orange"
        >
          <PencilSquareIcon className="h-4 w-4" />
          {open ? "Close" : "Add"}
        </button>
      </div>

      {open && (
        <div className="mt-3">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="Internal note visible to HR only…"
            className="w-full resize-none rounded-xl border border-border bg-white/70 px-3 py-2.5 text-sm text-charcoal outline-none placeholder:text-text-secondary focus:border-orange"
          />
          {error && <p className="mt-1 text-sm text-coral">{error}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={save}
              disabled={!draft.trim() || busy}
              className="rounded-xl bg-orange px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange/90 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save Note"}
            </button>
          </div>
        </div>
      )}

      {note ? (
        <div className="mt-3 rounded-xl bg-cream/70 p-4 text-sm text-text-secondary">
          <p className="whitespace-pre-wrap">{note.body}</p>
          <p className="mt-3 text-xs font-medium text-charcoal">
            {note.author_name ?? "HR"}, {formatDate(note.created_at)}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-text-secondary">
          No notes for this candidate yet.
        </p>
      )}
    </Card>
  );
}
