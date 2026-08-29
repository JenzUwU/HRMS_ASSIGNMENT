"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/lib/toast";
import { mutationErrorMessage } from "@/lib/ai-error";
import {
  getAutomationStatus,
  runEngagementSweep,
  type AutomationStatus,
  type EngagementSweepResult,
} from "@/lib/api";
import { formatDateTime } from "@/lib/format";

export default function AutomationPage() {
  const [status, setStatus] = useState<AutomationStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [result, setResult] = useState<EngagementSweepResult | null>(null);

  const load = useCallback(() => {
    getAutomationStatus()
      .then((s) => {
        setStatus(s);
        setStatusError(null);
        if (s.last_run) setResult(s.last_run);
      })
      .catch((e) =>
        setStatusError(mutationErrorMessage(e, "Could not load automation status.")),
      );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function run() {
    if (running) return;
    setRunning(true);
    try {
      const res = await runEngagementSweep({ dry_run: dryRun });
      setResult(res);
      toast(
        dryRun
          ? `Dry run: ${res.eligible} eligible, no records written`
          : `Sweep done: ${res.processed} processed, ${res.skipped} skipped, ${res.failed} failed`,
        "success",
      );
      load();
    } catch (e) {
      toast(mutationErrorMessage(e, "The sweep could not run."), "error");
    } finally {
      setRunning(false);
    }
  }

  return (
    <AppShell title="Automation">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <h3 className="font-heading text-base font-semibold text-charcoal">
            Engagement Sweep
          </h3>
          {statusError && <p className="mt-2 text-sm text-coral">{statusError}</p>}
          {status && (
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Rule">{status.rule}</Row>
              <Row label="Background loop">
                <Badge tone={status.background_loop_enabled ? "teal" : "neutral"}>
                  {status.background_loop_enabled ? "enabled" : "disabled"}
                </Badge>
              </Row>
              <Row label="Interval">{status.interval_minutes} min</Row>
              <Row label="Joining window">{status.joining_window_days} days</Row>
              <Row label="No-interaction">{status.no_interaction_days} days</Row>
              <Row label="Dedup window">{status.dedup_days} days</Row>
              <Row label="Last run">
                {status.last_run
                  ? formatDateTime(status.last_run.ran_at)
                  : "never"}
              </Row>
            </dl>
          )}
          <p className="mt-4 rounded-lg bg-peach/40 px-3 py-2 text-xs text-charcoal">
            Running a sweep creates follow-up <strong>tasks</strong> and AI{" "}
            <strong>message drafts</strong> for eligible candidates. The
            in-process scheduler is a prototype convenience and is disabled by
            default — production should drive this endpoint from an external
            scheduler.
          </p>
          <label className="mt-3 flex items-center gap-2 text-sm text-charcoal">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
            />
            Dry run (evaluate only, write nothing)
          </label>
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-orange px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-transparent" />
            )}
            {running ? "Running…" : dryRun ? "Run dry sweep" : "Run sweep"}
          </button>
        </Card>

        <Card className="lg:col-span-2">
          <h3 className="font-heading text-base font-semibold text-charcoal">
            {result?.dry_run ? "Last dry run" : "Last run"}
          </h3>
          {!result ? (
            <p className="mt-3 text-sm text-text-secondary">
              No sweep has run yet.
            </p>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {(
                  [
                    ["Scanned", result.scanned],
                    ["Eligible", result.eligible],
                    ["Processed", result.processed],
                    ["Skipped", result.skipped],
                    ["Failed", result.failed],
                  ] as const
                ).map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl bg-cream/70 p-3 text-center"
                  >
                    <p className="font-heading text-xl font-bold text-charcoal">
                      {value}
                    </p>
                    <p className="text-[11px] text-text-secondary">{label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
                      <th className="pb-2">Candidate</th>
                      <th className="pb-2">Joining</th>
                      <th className="pb-2">Idle</th>
                      <th className="pb-2">Outcome</th>
                      <th className="pb-2">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.results.map((r) => (
                      <tr key={r.candidate_id} className="border-t border-border">
                        <td className="py-2 font-medium text-charcoal">
                          {r.full_name}
                        </td>
                        <td className="py-2 text-text-secondary">
                          {r.joining_in_days == null
                            ? "-"
                            : `${r.joining_in_days}d`}
                        </td>
                        <td className="py-2 text-text-secondary">
                          {r.days_since_interaction == null
                            ? "-"
                            : `${r.days_since_interaction}d`}
                        </td>
                        <td className="py-2">
                          <Badge
                            tone={
                              r.outcome === "processed"
                                ? "teal"
                                : r.outcome === "failed"
                                  ? "coral"
                                  : "neutral"
                            }
                          >
                            {r.outcome}
                          </Badge>
                        </td>
                        <td className="py-2 text-text-secondary">
                          {r.reason ?? ""}
                        </td>
                      </tr>
                    ))}
                    {result.results.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-4 text-center text-text-secondary"
                        >
                          No eligible candidates in this run.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="text-right font-semibold text-charcoal">{children}</dd>
    </div>
  );
}
