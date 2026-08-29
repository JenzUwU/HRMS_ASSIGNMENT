"use client";

/**
 * AI workspace for one candidate. Talks only to the existing Groq-backed
 * endpoints via lib/api. Every generated result is clearly a DRAFT / assistive
 * output that HR reviews — never an action taken on the candidate's behalf.
 */
import { useCallback, useEffect, useState } from "react";
import { SparklesIcon } from "@heroicons/react/24/solid";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import { aiErrorMessage, mutationErrorMessage } from "@/lib/ai-error";
import {
  aiDraftMessage,
  aiNextAction,
  aiRisk,
  aiSummary,
  getAiRecommendations,
  patchAiRecommendation,
  type AiChannel,
  type AiResult,
  type AIRecommendationRecord,
  type InteractionSummary,
  type NextBestAction,
  type PersonalizedMessage,
  type RiskClassification,
} from "@/lib/api";
import { formatDateTime } from "@/lib/format";

type Tool = "message" | "summary" | "next-action" | "risk";

const TOOLS: { key: Tool; label: string }[] = [
  { key: "message", label: "Message" },
  { key: "summary", label: "Summary" },
  { key: "next-action", label: "Next Action" },
  { key: "risk", label: "Risk" },
];

const CHANNELS: AiChannel[] = ["email", "whatsapp", "sms"];

function confidenceLabel(c: number): string {
  const pct = Math.round(c * 100);
  if (c >= 0.75) return `High confidence (${pct}%)`;
  if (c >= 0.5) return `Moderate confidence (${pct}%)`;
  return `Low confidence (${pct}%)`;
}

interface ToolState<T> {
  status: "idle" | "loading" | "done" | "error";
  data?: AiResult<T>;
  error?: string;
}

const idle = { status: "idle" as const };

export function CandidateAiPanel({ slug }: { slug: string }) {
  const [tool, setTool] = useState<Tool>("message");

  const [channel, setChannel] = useState<AiChannel>("email");
  const [purpose, setPurpose] = useState("");

  const [message, setMessage] = useState<ToolState<PersonalizedMessage>>(idle);
  const [summary, setSummary] = useState<ToolState<InteractionSummary>>(idle);
  const [nextAction, setNextAction] = useState<ToolState<NextBestAction>>(idle);
  const [risk, setRisk] = useState<ToolState<RiskClassification>>(idle);

  const [history, setHistory] = useState<AIRecommendationRecord[]>([]);
  const [overrideFor, setOverrideFor] = useState<string | null>(null);
  const [overrideText, setOverrideText] = useState("");
  const [overrideBusy, setOverrideBusy] = useState(false);

  const loadHistory = useCallback(() => {
    getAiRecommendations(slug)
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [slug]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function run<T>(
    setState: (s: ToolState<T>) => void,
    call: () => Promise<AiResult<T>>,
  ) {
    setState({ status: "loading" });
    try {
      const data = await call();
      setState({ status: "done", data });
      loadHistory();
    } catch (e) {
      setState({ status: "error", error: aiErrorMessage(e) });
    }
  }

  const busy =
    message.status === "loading" ||
    summary.status === "loading" ||
    nextAction.status === "loading" ||
    risk.status === "loading";

  async function applyOverride(
    recId: string,
    action: "accept" | "dismiss" | "override",
  ) {
    setOverrideBusy(true);
    try {
      await patchAiRecommendation(recId, {
        action,
        override_text: action === "override" ? overrideText : undefined,
      });
      toast(
        action === "accept"
          ? "Recommendation accepted"
          : action === "dismiss"
            ? "Recommendation dismissed"
            : "Override saved",
        "success",
      );
      setOverrideFor(null);
      setOverrideText("");
      loadHistory();
    } catch (e) {
      toast(mutationErrorMessage(e, "Could not update the recommendation."), "error");
    } finally {
      setOverrideBusy(false);
    }
  }

  return (
    <Card>
      <h3 className="flex items-center gap-2 font-heading text-base font-semibold text-charcoal">
        <SparklesIcon className="h-4 w-4 text-orange" />
        AI Assistant
      </h3>
      <p className="mt-1 text-xs text-text-secondary">
        Assistive drafts and analysis. Every result needs HR review before it is
        used or sent.
      </p>

      <div className="mt-3 flex gap-1 border-b border-border">
        {TOOLS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTool(t.key)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition-colors",
              tool === t.key
                ? "border-orange text-orange"
                : "border-transparent text-text-secondary hover:text-charcoal",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tool === "message" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm font-medium text-charcoal">Channel</label>
              {CHANNELS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setChannel(c)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-xs font-semibold capitalize transition-colors",
                    channel === c
                      ? "border-orange bg-peach/50 text-orange"
                      : "border-border text-charcoal hover:border-orange/40",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
            <input
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Purpose (optional), e.g. nudge on pending documents"
              className="w-full rounded-xl border border-border bg-white/70 px-3 py-2 text-sm text-charcoal outline-none focus:border-orange"
            />
            <GenerateButton
              busy={busy}
              loading={message.status === "loading"}
              onClick={() =>
                run(setMessage, () =>
                  aiDraftMessage(slug, {
                    channel,
                    purpose: purpose.trim() || null,
                  }),
                )
              }
              label={message.status === "done" ? "Regenerate" : "Generate message"}
            />
            <ErrorLine state={message} />
            {message.status === "done" && message.data && (
              <div className="rounded-xl border border-border bg-cream/50 p-3">
                <Badge tone="amber" className="mb-2">
                  Draft — review before sending
                </Badge>
                {message.data.result.subject && (
                  <p className="text-sm font-semibold text-charcoal">
                    Subject: {message.data.result.subject}
                  </p>
                )}
                <p className="mt-1 whitespace-pre-wrap text-sm text-charcoal">
                  {message.data.result.body}
                </p>
                {message.data.result.personalization_rationale && (
                  <p className="mt-2 border-t border-border pt-2 text-xs text-text-secondary">
                    Why this: {message.data.result.personalization_rationale}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <MiniButton
                    onClick={() => {
                      const r = message.data!.result;
                      navigator.clipboard
                        ?.writeText(
                          r.subject ? `${r.subject}\n\n${r.body}` : r.body,
                        )
                        .then(() => toast("Copied", "success"))
                        .catch(() => toast("Could not copy", "error"));
                    }}
                  >
                    Copy
                  </MiniButton>
                  <RecoActions
                    meta={message.data.meta}
                    overrideFor={overrideFor}
                    setOverrideFor={setOverrideFor}
                    overrideText={overrideText}
                    setOverrideText={setOverrideText}
                    busy={overrideBusy}
                    apply={applyOverride}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {tool === "summary" && (
          <div className="space-y-3">
            <GenerateButton
              busy={busy}
              loading={summary.status === "loading"}
              onClick={() => run(setSummary, () => aiSummary(slug))}
              label={
                summary.status === "done" ? "Regenerate" : "Generate summary"
              }
            />
            <ErrorLine state={summary} />
            {summary.status === "done" && summary.data && (
              <div className="space-y-2 rounded-xl border border-border bg-cream/50 p-3 text-sm">
                <p className="text-charcoal">{summary.data.result.summary}</p>
                <List title="Key concerns" items={summary.data.result.key_concerns} tone="coral" />
                <List
                  title="Positive signals"
                  items={summary.data.result.positive_signals}
                  tone="teal"
                />
                <List
                  title="Unanswered issues"
                  items={summary.data.result.unanswered_issues}
                  tone="amber"
                />
              </div>
            )}
          </div>
        )}

        {tool === "next-action" && (
          <div className="space-y-3">
            <GenerateButton
              busy={busy}
              loading={nextAction.status === "loading"}
              onClick={() => run(setNextAction, () => aiNextAction(slug))}
              label={
                nextAction.status === "done"
                  ? "Regenerate"
                  : "Suggest next action"
              }
            />
            <ErrorLine state={nextAction} />
            {nextAction.status === "done" && nextAction.data && (
              <div className="space-y-2 rounded-xl border border-border bg-cream/50 p-3 text-sm">
                <p className="font-semibold text-charcoal">
                  {nextAction.data.result.action}
                </p>
                <p className="text-text-secondary">
                  {nextAction.data.result.rationale}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Badge tone="peach" className="capitalize">
                    via {nextAction.data.result.suggested_channel}
                  </Badge>
                  <Badge tone="neutral">
                    {confidenceLabel(nextAction.data.result.confidence)}
                  </Badge>
                </div>
              </div>
            )}
          </div>
        )}

        {tool === "risk" && (
          <div className="space-y-3">
            <p className="rounded-lg bg-peach/40 px-3 py-2 text-xs text-charcoal">
              This is an <strong>AI-generated</strong> assessment to support HR
              judgement — not an objective or final rating. Use the HR override
              on the candidate&rsquo;s risk card to record a manual decision.
            </p>
            <GenerateButton
              busy={busy}
              loading={risk.status === "loading"}
              onClick={() => run(setRisk, () => aiRisk(slug))}
              label={risk.status === "done" ? "Re-run assessment" : "Assess risk"}
            />
            <ErrorLine state={risk} />
            {risk.status === "done" && risk.data && (
              <div className="space-y-2 rounded-xl border border-border bg-cream/50 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <Badge
                    tone={
                      risk.data.result.level === "high"
                        ? "coral"
                        : risk.data.result.level === "medium"
                          ? "amber"
                          : "teal"
                    }
                    dot
                  >
                    {risk.data.result.level.toUpperCase()} · {risk.data.result.score}/100
                  </Badge>
                  <span className="text-xs text-text-secondary">AI generated</span>
                </div>
                <p className="text-charcoal">{risk.data.result.summary}</p>
                <List title="Factors" items={risk.data.result.factors} tone="coral" />
                <p className="border-t border-border pt-2 text-text-secondary">
                  Recommended: {risk.data.result.recommended_action}
                </p>
                {risk.data.meta.corrections.length > 0 && (
                  <p className="text-xs text-text-secondary">
                    Adjusted by validation: {risk.data.meta.corrections.join("; ")}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Recent AI recommendations
          </p>
          <ul className="space-y-1.5">
            {history.slice(0, 6).map((h) => (
              <li
                key={h.id}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="text-charcoal">
                  {h.kind.replace("_", " ")}
                  {h.is_current && (
                    <span className="ml-1 text-teal">· current</span>
                  )}
                </span>
                <span className="text-text-secondary">
                  {h.status}
                  {h.model ? ` · ${h.model}` : ""} · {formatDateTime(h.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function GenerateButton({
  busy,
  loading,
  onClick,
  label,
}: {
  busy: boolean;
  loading: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-xl bg-orange px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange/90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-transparent" />
      )}
      {loading ? "Generating…" : label}
    </button>
  );
}

function ErrorLine({ state }: { state: { status: string; error?: string } }) {
  if (state.status !== "error") return null;
  return <p className="text-sm text-coral">{state.error}</p>;
}

function MiniButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-charcoal transition-colors hover:border-orange/40 hover:text-orange disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function List({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "coral" | "teal" | "amber";
}) {
  if (!items || items.length === 0) return null;
  const dot =
    tone === "coral" ? "bg-coral" : tone === "teal" ? "bg-teal" : "bg-warning";
  return (
    <div>
      <p className="text-xs font-semibold text-charcoal">{title}</p>
      <ul className="mt-1 space-y-1">
        {items.map((it) => (
          <li key={it} className="flex gap-2 text-text-secondary">
            <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RecoActions({
  meta,
  overrideFor,
  setOverrideFor,
  overrideText,
  setOverrideText,
  busy,
  apply,
}: {
  meta: { persisted: boolean; record_id: string | null };
  overrideFor: string | null;
  setOverrideFor: (v: string | null) => void;
  overrideText: string;
  setOverrideText: (v: string) => void;
  busy: boolean;
  apply: (id: string, action: "accept" | "dismiss" | "override") => void;
}) {
  if (!meta.persisted || !meta.record_id) return null;
  const id = meta.record_id;
  if (overrideFor === id) {
    return (
      <div className="w-full space-y-2">
        <textarea
          value={overrideText}
          onChange={(e) => setOverrideText(e.target.value)}
          rows={3}
          placeholder="HR override text (kept alongside the original AI draft)…"
          className="w-full resize-none rounded-lg border border-border bg-white/70 px-2.5 py-2 text-xs text-charcoal outline-none focus:border-orange"
        />
        <div className="flex gap-2">
          <MiniButton
            onClick={() => apply(id, "override")}
            disabled={busy || !overrideText.trim()}
          >
            Save override
          </MiniButton>
          <MiniButton onClick={() => setOverrideFor(null)} disabled={busy}>
            Cancel
          </MiniButton>
        </div>
      </div>
    );
  }
  return (
    <>
      <MiniButton onClick={() => apply(id, "accept")} disabled={busy}>
        Accept
      </MiniButton>
      <MiniButton onClick={() => apply(id, "dismiss")} disabled={busy}>
        Dismiss
      </MiniButton>
      <MiniButton onClick={() => setOverrideFor(id)} disabled={busy}>
        Override…
      </MiniButton>
    </>
  );
}
