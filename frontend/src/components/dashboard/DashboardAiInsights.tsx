"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, SparklesIcon } from "@heroicons/react/24/solid";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import { aiErrorMessage } from "@/lib/ai-error";
import {
  aiNextAction,
  aiRisk,
  aiSummary,
  getCandidateAiInsights,
  type CandidateAiInsights,
  type CandidateListItem,
} from "@/lib/api";

/**
 * Concise AI Insights for the dashboard: the AI risk read and recommended next
 * action for the candidate most in need of attention, so HR sees WHY straight
 * from the main workflow. All values are persisted server-side; the generate
 * action calls the existing POST ai/* endpoints.
 */
export function DashboardAiInsights({
  candidates,
}: {
  candidates: CandidateListItem[];
}) {
  const focus = candidates[0] ?? null;
  const others = Math.max(0, candidates.length - 1);

  const [data, setData] = useState<CandidateAiInsights | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    focus ? "loading" : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    if (!focus) return;
    setStatus("loading");
    setError(null);
    try {
      setData(await getCandidateAiInsights(focus.slug));
      setStatus("ready");
    } catch (e) {
      setData(null);
      setError(aiErrorMessage(e));
      setStatus("error");
    }
  }, [focus]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function generate() {
    if (!focus || generating) return;
    setGenerating(true);
    try {
      const res = await Promise.allSettled([
        aiSummary(focus.slug),
        aiNextAction(focus.slug),
        aiRisk(focus.slug),
      ]);
      const failed = res.filter((r) => r.status === "rejected").length;
      toast(
        failed === res.length
          ? "Could not generate AI insights"
          : failed > 0
            ? "Some AI insights could not be generated"
            : "AI insights generated",
        failed === res.length ? "error" : "success",
      );
      await load();
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Card className="flex flex-col p-0">
      <div className="flex items-center justify-between px-5 pt-5">
        <h3 className="flex items-center gap-2 font-heading text-base font-semibold text-charcoal">
          <SparklesIcon className="h-4 w-4 text-orange" />
          AI Insights
        </h3>
        {focus && (
          <Link
            href={`/candidates/${focus.slug}`}
            className="flex items-center gap-1 text-sm font-semibold text-orange hover:text-orange/80"
          >
            Open candidate
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      <div className="flex-1 px-5 py-4 text-sm">
        {!focus && (
          <p className="py-4 text-center text-text-secondary">
            No candidates currently need attention.
          </p>
        )}

        {focus && (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-charcoal">
                {focus.full_name}
              </span>
              {others > 0 && (
                <span className="text-xs text-text-secondary">
                  +{others} more flagged
                </span>
              )}
            </div>

            {status === "loading" && (
              <div className="mt-3 space-y-2">
                <div className="h-4 w-1/2 animate-pulse rounded bg-border" />
                <div className="h-4 w-full animate-pulse rounded bg-border" />
              </div>
            )}

            {status === "error" && (
              <p className="mt-3 text-coral">
                {error}{" "}
                <button
                  type="button"
                  onClick={load}
                  className="cursor-pointer font-semibold text-orange hover:underline"
                >
                  Retry
                </button>
              </p>
            )}

            {status === "ready" && data && !data.has_any && (
              <div className="mt-3">
                <p className="text-text-secondary">
                  No AI analysis yet for this candidate.
                </p>
                <button
                  type="button"
                  onClick={generate}
                  disabled={generating}
                  className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-orange px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-orange/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {generating && (
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/50 border-t-transparent" />
                  )}
                  {generating ? "Generating…" : "Generate AI insights"}
                </button>
              </div>
            )}

            {status === "ready" && data && data.has_any && (
              <div className="mt-3 space-y-2.5">
                {data.risk && (
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        tone={
                          data.risk.level === "high"
                            ? "coral"
                            : data.risk.level === "medium"
                              ? "amber"
                              : "teal"
                        }
                        dot
                      >
                        {data.risk.level.toUpperCase()} · {data.risk.score}/100
                      </Badge>
                      {data.risk.overridden && (
                        <Badge tone="peach">HR override</Badge>
                      )}
                    </div>
                    {data.risk.summary && (
                      <p className="mt-1 line-clamp-3 text-text-secondary">
                        {data.risk.summary}
                      </p>
                    )}
                  </div>
                )}

                {data.next_best_action && (
                  <div className="border-t border-border pt-2.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                      Recommended next action
                    </p>
                    <p className="mt-1 font-medium text-charcoal">
                      {data.next_best_action.action}
                    </p>
                    <Badge
                      tone="neutral"
                      className={cn("mt-1.5 capitalize")}
                    >
                      via {data.next_best_action.suggested_channel}
                    </Badge>
                  </div>
                )}

                {!data.risk && !data.next_best_action && data.candidate_next_action && (
                  <p className="text-text-secondary">
                    {data.candidate_next_action}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
