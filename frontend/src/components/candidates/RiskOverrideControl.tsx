"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheckIcon } from "@heroicons/react/24/solid";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/lib/toast";
import { mutationErrorMessage } from "@/lib/ai-error";
import { getRiskHistory, patchRiskAssessment, type RiskRecord } from "@/lib/api";

const LEVELS = ["low", "medium", "high"] as const;

export function RiskOverrideControl({ slug }: { slug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("medium");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ prev: RiskRecord | null } | null>(null);

  async function submit() {
    const r = reason.trim();
    if (!r || busy) return;
    setBusy(true);
    setError(null);
    try {
      const history = await getRiskHistory(slug);
      const current = history.find((h) => h.is_current);
      if (!current) throw new Error("no current assessment");
      const res = await patchRiskAssessment(current.id, { level, reason: r });
      setDone({ prev: res.previous_ai_assessment });
      setReason("");
      setOpen(false);
      toast("HR risk override recorded", "success");
      router.refresh();
    } catch (e) {
      setError(mutationErrorMessage(e, "Could not record the override."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-heading text-base font-semibold text-charcoal">
          <ShieldCheckIcon className="h-4 w-4 text-orange" />
          HR Risk Override
        </h3>
        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            setError(null);
          }}
          className="text-sm font-semibold text-orange"
        >
          {open ? "Close" : "Override"}
        </button>
      </div>
      <p className="mt-1 text-xs text-text-secondary">
        Records a manual assessment (<code>source=manual</code>). The current AI
        assessment is preserved in history, not overwritten.
      </p>

      {open && (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            {LEVELS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLevel(l)}
                className={`rounded-lg border px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                  level === l
                    ? "border-orange bg-peach/50 text-orange"
                    : "border-border text-charcoal hover:border-orange/40"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Reason for the manual override (required)…"
            className="w-full resize-none rounded-xl border border-border bg-white/70 px-3 py-2 text-sm text-charcoal outline-none focus:border-orange"
          />
          {error && <p className="text-sm text-coral">{error}</p>}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={submit}
              disabled={!reason.trim() || busy}
              className="rounded-xl bg-orange px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange/90 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Record Override"}
            </button>
          </div>
        </div>
      )}

      {done && (
        <div className="mt-3 rounded-xl bg-cream/70 p-3 text-xs text-text-secondary">
          <Badge tone="teal" className="mb-1">
            Manual override active
          </Badge>
          <p>
            Previous AI assessment kept:{" "}
            {done.prev
              ? `${done.prev.level.toUpperCase()} / ${done.prev.score}`
              : "none on record"}
            .
          </p>
        </div>
      )}
    </Card>
  );
}
