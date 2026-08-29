"use client";

import { useCallback, useEffect, useState } from "react";
import { SparklesIcon } from "@heroicons/react/24/solid";
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
} from "@/lib/api";
import { formatDateTime } from "@/lib/format";

/**
 * Read-only AI Insights for one candidate: risk overview, interaction summary,
 * next best action, HR override state and recent recommendation history. Every
 * value is persisted server-side (the /ai/insights aggregate). When nothing has
 * been generated yet, HR can trigger generation with the existing POST ai/*
 * endpoints. Nothing here is fabricated on the client.
 */
export function AiInsightsCard({ slug }: { slug: string }) {
  const [data, setData] = useState<CandidateAiInsights | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      setData(await getCandidateAiInsights(slug));
      setStatus("ready");
    } catch (e) {
      setData(null);
      setError(aiErrorMessage(e));
      setStatus("error");
    }
  }, [slug]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function generate() {
    if (generating) return;
    setGenerating(true);
    try {
      // The three read-model tools. Each persists its own record server-side.
      const results = await Promise.allSettled([
        aiSummary(slug),
        aiNextAction(slug),
        aiRisk(slug),
      ]);
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed === results.length) {
        toast("Could not generate AI insights", "error");
      } else if (failed > 0) {
        toast("Some AI insights could not be generated", "error");
      } else {
        toast("AI insights generated", "success");
      }
      await load();
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-heading text-base font-semibold text-charcoal">
          <SparklesIcon className="h-4 w-4 text-orange" />
          AI Insights
        </h3>
        {status === "ready" && data?.has_any && (
          <button
            type="button"
            onClick={load}
            className="cursor-pointer text-xs font-semibold text-orange hover:text-orange/80"
          >
            Reload
          </button>
        )}
      </div>

      {status === "loading" && (
        <div className="mt-3 space-y-2">
          <div className="h-4 w-2/3 animate-pulse rounded bg-border" />
          <div className="h-4 w-full animate-pulse rounded bg-border" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-border" />
        </div>
      )}

      {status === "error" && (
        <div className="mt-3 text-sm">
          <p className="text-coral">{error}</p>
          <button
            type="button"
            onClick={load}
            className="mt-2 cursor-pointer font-semibold text-orange hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {status === "ready" && data && !data.has_any && (
        <div className="mt-3 text-sm">
          <p className="text-text-secondary">
            No AI analysis for this candidate yet. Generate a risk assessment,
            interaction summary and next best action from the current
            engagement history.
          </p>
          {data.candidate_next_action && (
            <p className="mt-2 text-xs text-text-secondary">
              Current recommended action ({data.candidate_next_action_source ??
                "system"}
              ): {data.candidate_next_action}
            </p>
          )}
          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-orange px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-transparent" />
            )}
            {generating ? "Generating…" : "Generate AI insights"}
          </button>
        </div>
      )}

      {status === "ready" && data && data.has_any && (
        <div className="mt-3 space-y-3 text-sm">
          <RiskBlock data={data} />
          <SummaryBlock data={data} />
          <NextActionBlock data={data} />
          <HistoryBlock data={data} />
        </div>
      )}
    </Card>
  );
}

function riskTone(level: string) {
  return level === "high" ? "coral" : level === "medium" ? "amber" : "teal";
}

function Bullets({ items, dot }: { items: string[]; dot: string }) {
  return (
    <ul className="mt-1 space-y-1">
      {items.map((it) => (
        <li key={it} className="flex gap-2 text-text-secondary">
          <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
          {it}
        </li>
      ))}
    </ul>
  );
}

function RiskBlock({ data }: { data: CandidateAiInsights }) {
  const r = data.risk;
  if (!r) return null;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={riskTone(r.level)} dot>
          {r.level.toUpperCase()} · {r.score}/100
        </Badge>
        {r.overridden ? (
          <Badge tone="peach">HR override</Badge>
        ) : (
          <span className="text-xs text-text-secondary">AI assessed</span>
        )}
      </div>
      {r.summary && <p className="mt-1 text-text-secondary">{r.summary}</p>}
      {r.factors.length > 0 && <Bullets items={r.factors} dot="bg-coral" />}
    </div>
  );
}

function SummaryBlock({ data }: { data: CandidateAiInsights }) {
  const s = data.interaction_summary;
  if (!s) return null;
  return (
    <div className="border-t border-border pt-3">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
        Interaction summary
        {data.interaction_summary_overridden && (
          <Badge tone="peach">overridden</Badge>
        )}
      </p>
      <p className="mt-1 text-text-secondary">{s.summary}</p>
      {data.interaction_summary_override_text && (
        <p className="mt-1 rounded-lg bg-peach/30 px-2 py-1 text-xs text-charcoal">
          HR note: {data.interaction_summary_override_text}
        </p>
      )}
      {s.key_concerns.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-semibold text-charcoal">Key concerns</p>
          <Bullets items={s.key_concerns} dot="bg-coral" />
        </div>
      )}
      {s.positive_signals.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-semibold text-charcoal">Positive signals</p>
          <Bullets items={s.positive_signals} dot="bg-teal" />
        </div>
      )}
      {s.unanswered_issues.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-semibold text-charcoal">Unanswered issues</p>
          <Bullets items={s.unanswered_issues} dot="bg-warning" />
        </div>
      )}
    </div>
  );
}

function NextActionBlock({ data }: { data: CandidateAiInsights }) {
  const n = data.next_best_action;
  if (!n) return null;
  const pct = Math.round(n.confidence * 100);
  const conf =
    n.confidence >= 0.75
      ? `High confidence (${pct}%)`
      : n.confidence >= 0.5
        ? `Moderate confidence (${pct}%)`
        : `Low confidence (${pct}%)`;
  return (
    <div className="border-t border-border pt-3">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
        Next best action
        {data.next_best_action_overridden && <Badge tone="peach">overridden</Badge>}
      </p>
      <p className="mt-1 font-medium text-charcoal">{n.action}</p>
      <p className="mt-0.5 text-text-secondary">{n.rationale}</p>
      {data.next_best_action_override_text && (
        <p className="mt-1 rounded-lg bg-peach/30 px-2 py-1 text-xs text-charcoal">
          HR note: {data.next_best_action_override_text}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <Badge tone="peach" className="capitalize">
          via {n.suggested_channel}
        </Badge>
        <Badge tone="neutral">{conf}</Badge>
      </div>
    </div>
  );
}

function HistoryBlock({ data }: { data: CandidateAiInsights }) {
  if (data.recent_recommendations.length === 0) return null;
  return (
    <div className="border-t border-border pt-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
        Recent AI recommendations
      </p>
      <ul className="space-y-1.5">
        {data.recent_recommendations.map((h) => (
          <li
            key={h.id}
            className="flex items-center justify-between gap-2 text-xs"
          >
            <span className="text-charcoal">
              {h.kind.replace(/_/g, " ")}
              {h.is_current && <span className="ml-1 text-teal">· current</span>}
              {h.overridden && <span className="ml-1 text-orange">· overridden</span>}
            </span>
            <span className="text-text-secondary">
              {h.status} · {formatDateTime(h.created_at)}
            </span>
          </li>
        ))}
      </ul>
      {data.generated_at && (
        <p className="mt-2 text-[11px] text-text-secondary">
          Updated {formatDateTime(data.generated_at)}
        </p>
      )}
    </div>
  );
}
