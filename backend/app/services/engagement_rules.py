"""Automated engagement rule: the pre-joining no-interaction sweep.

RULE (pre_joining_no_interaction)
--------------------------------
A candidate needs an automated nudge when ALL of these hold:

  1. status is not 'joined' and not 'declined'
  2. joining_date is in the future window:  today <= joining_date <= today + 7
  3. no candidate interaction in the last 5 days, where "interaction" is
     candidates.last_interaction_at (the denormalized last two-way engagement
     timestamp the rest of the app already maintains). A NULL value means the
     candidate has never interacted, which also satisfies "no interaction in the
     last 5 days".

Windows (7 / 5) come from settings.automation_joining_window_days /
settings.automation_no_interaction_days.

For each eligible candidate the sweep:
  - drafts a personalized recruiter message via the existing Groq AI service
    (app/services/ai.draft_message -> validated PersonalizedMessage)
  - creates an HR follow-up task (tasks, source='automation')
  - persists the draft to ai_recommendations (kind='message_draft')
  - records an engagement_event (event_type='reminder_sent', actor='system',
    metadata.automation=True, metadata.rule=...)

DEDUPLICATION
-------------
Before acting on a candidate the sweep skips if EITHER:
  a. an open/in_progress task with source='automation' already exists for them
     (HR still has the follow-up to do), OR
  b. a matching automation engagement_event was recorded in the last
     settings.automation_dedup_days days (covers the case where HR closed the
     task quickly but the condition still holds).

The candidate becomes eligible again automatically once the task is
closed/dismissed AND the dedup window has passed AND the rule still matches
(e.g. still no interaction). A genuine candidate reply updates
last_interaction_at and removes them from the eligible set on the next run.

One candidate failing (AI error, DB error) is isolated: it is marked "failed"
with a reason and the sweep continues.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from supabase import Client

from app.core.config import settings
from app.core.errors import AppError
from app.core.logging import logger
from app.db import repositories as repo
from app.schemas.ai import AIChannel
from app.schemas.automation import EngagementSweepResult, SweepCandidateResult
from app.services import ai as ai_service
from app.services import recruiter_notify

RULE_ID = "pre_joining_no_interaction"
RULE_DESCRIPTION = (
    "joining within {jw} days AND no candidate interaction in the last {ni} days"
)

_LAST_RUN: EngagementSweepResult | None = None


def get_last_run() -> EngagementSweepResult | None:
    return _LAST_RUN


def rule_description() -> str:
    return RULE_DESCRIPTION.format(
        jw=settings.automation_joining_window_days,
        ni=settings.automation_no_interaction_days,
    )


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_date(value) -> date | None:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def _parse_dt(value) -> datetime | None:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        raw = str(value).replace("Z", "+00:00")
        parsed = datetime.fromisoformat(raw)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def evaluate_candidate(
    candidate: dict,
    *,
    today: date | None = None,
    now: datetime | None = None,
    joining_window_days: int | None = None,
    no_interaction_days: int | None = None,
) -> tuple[bool, str]:
    """Pure re-check of the rule for one candidate row.

    Returns (eligible, reason). Mirrors the SQL filter in
    repositories.list_automation_eligible_candidates so a bad/stale row from the
    view can never be acted on. Reason is human-readable for the sweep output.
    """
    today = today or date.today()
    now = now or datetime.now(timezone.utc)
    jw = (
        joining_window_days
        if joining_window_days is not None
        else settings.automation_joining_window_days
    )
    ni = (
        no_interaction_days
        if no_interaction_days is not None
        else settings.automation_no_interaction_days
    )

    status = (candidate.get("status") or "").lower()
    if status in ("joined", "declined"):
        return False, f"status is '{status}'"

    jd = _parse_date(candidate.get("joining_date"))
    if jd is None:
        return False, "no joining_date on record"
    days_to_join = (jd - today).days
    if days_to_join < 0:
        return False, f"joining_date is {abs(days_to_join)} day(s) in the past"
    if days_to_join > jw:
        return False, f"joining_date is {days_to_join} day(s) out (> {jw})"

    last = _parse_dt(candidate.get("last_interaction_at"))
    if last is None:
        return True, "no interaction on record"
    days_since = (now - last).days
    if days_since < ni:
        return False, f"interacted {days_since} day(s) ago (< {ni})"
    return True, f"no interaction in {days_since} day(s)"


def _channel_for(value: str | None) -> AIChannel:
    try:
        return AIChannel(value) if value else AIChannel.email
    except ValueError:
        return AIChannel.email


def _purpose(candidate: dict) -> str:
    dj = candidate.get("joining_in_days")
    di = candidate.get("days_since_interaction")
    return (
        f"Pre-joining follow-up. The candidate joins in {dj} day(s) and there "
        f"has been no interaction in about {di if di is not None else '5+'} "
        "day(s). Warmly reconnect, confirm they are on track for the joining "
        "date, and invite them to raise any blockers (documents, relocation, "
        "logistics). Do not assume a specific concern unless the context shows one."
    )


def _task_priority(joining_in_days) -> str:
    if joining_in_days is None:
        return "medium"
    return "high" if joining_in_days <= 3 else "medium"


def _task_detail(candidate: dict, msg) -> str:
    dj = candidate.get("joining_in_days")
    di = candidate.get("days_since_interaction")
    lines = [
        f"Automated flag: joining in {dj} day(s); no interaction in "
        f"{di if di is not None else '5+'} day(s).",
        f"AI-drafted {msg.channel.value} follow-up (review and personalize "
        "before sending):",
        "",
    ]
    if msg.subject:
        lines.append(f"Subject: {msg.subject}")
    lines.append(msg.body)
    return "\n".join(lines)


def _process_candidate(
    db: Client, c: dict, *, dry_run: bool, dedup_since_iso: str
) -> SweepCandidateResult:
    base = dict(
        candidate_id=c["id"],
        slug=c["slug"],
        full_name=c["full_name"],
        joining_in_days=c.get("joining_in_days"),
        days_since_interaction=c.get("days_since_interaction"),
    )

    # ---- defensive re-check of the rule (view could be stale) --------
    ok, why = evaluate_candidate(c)
    if not ok:
        return SweepCandidateResult(
            **base, outcome="skipped", reason=f"no longer eligible: {why}"
        )

    # ---- deduplication -------------------------------------------------
    try:
        if repo.has_open_automation_task(db, c["id"]):
            return SweepCandidateResult(
                **base,
                outcome="skipped",
                reason="an open automation task already exists",
            )
        if repo.recent_automation_event_exists(
            db, c["id"], rule=RULE_ID, since_iso=dedup_since_iso
        ):
            return SweepCandidateResult(
                **base,
                outcome="skipped",
                reason=(
                    f"automation ran for this rule within the last "
                    f"{settings.automation_dedup_days} day(s)"
                ),
            )
    except AppError as exc:
        return SweepCandidateResult(
            **base, outcome="failed", reason=f"dedup-check:{exc.code}"
        )

    if dry_run:
        return SweepCandidateResult(
            **base, outcome="processed", reason="eligible (dry run; no writes)"
        )

    # ---- 1. AI message via the existing service -----------------------
    channel = _channel_for(c.get("last_interaction_channel"))
    try:
        msg, prompt_context = ai_service.draft_message(
            db, c, channel=channel, purpose=_purpose(c)
        )
    except AppError as exc:
        logger.warning("automation: AI draft failed for %s (%s)", c["slug"], exc.code)
        return SweepCandidateResult(
            **base, outcome="failed", reason=f"ai:{exc.code}"
        )

    # ---- 2/3/4. persistence (task -> recommendation -> event) ---------
    task_id = rec_id = event_id = None
    try:
        task = repo.insert_task(
            db,
            candidate_id=c["id"],
            assigned_recruiter_id=c.get("recruiter_id"),
            title=f"Follow up with {c['full_name']} before joining",
            detail=_task_detail(c, msg),
            related_stage=c.get("current_stage"),
            priority=_task_priority(c.get("joining_in_days")),
            source="automation",
            due_date=date.today().isoformat(),
        )
        task_id = task["id"]

        rec = repo.insert_ai_recommendation(
            db,
            candidate_id=c["id"],
            kind="message_draft",
            payload=msg.model_dump(mode="json"),
            prompt_context=prompt_context,
            model=settings.groq_model,
        )
        rec_id = rec["id"]

        ev = repo.insert_engagement_event(
            db,
            candidate_id=c["id"],
            event_type="reminder_sent",
            stage=c.get("current_stage"),
            actor="system",
            channel=msg.channel.value,
            title="Automated pre-joining follow-up",
            description=(
                f"Automation flagged {c['full_name']}: joining in "
                f"{c.get('joining_in_days')} day(s) with no interaction in "
                f"{c.get('days_since_interaction') if c.get('days_since_interaction') is not None else '5+'} "
                f"day(s). An AI {msg.channel.value} follow-up was drafted for HR."
            ),
            occurred_at=_now_iso(),
            metadata={
                "automation": True,
                "rule": RULE_ID,
                "task_id": task_id,
                "recommendation_id": rec_id,
                "joining_in_days": c.get("joining_in_days"),
                "days_since_interaction": c.get("days_since_interaction"),
                "model": settings.groq_model,
            },
        )
        event_id = ev["id"]
    except AppError as exc:
        logger.warning(
            "automation: persistence failed for %s (%s)", c["slug"], exc.code
        )
        return SweepCandidateResult(
            **base,
            outcome="failed",
            reason=f"db:{exc.code}",
            task_id=task_id,
            recommendation_id=rec_id,
            event_id=event_id,
            message_channel=msg.channel.value,
        )

    # Notify the assigned recruiter about the new follow-up task. Best-effort;
    # deduped by task_id so a re-run that somehow reaches here sends nothing.
    recruiter_notify.notify_automation_task(
        db,
        c,
        task_id=task_id,
        detail=(
            f"Automation flagged {c['full_name']}: joining in "
            f"{c.get('joining_in_days')} day(s) with no recent interaction. "
            "An AI follow-up draft is attached to the task."
        ),
    )

    return SweepCandidateResult(
        **base,
        outcome="processed",
        task_id=task_id,
        recommendation_id=rec_id,
        event_id=event_id,
        message_channel=msg.channel.value,
    )


def run_engagement_sweep(
    db: Client, *, dry_run: bool = False, limit: int | None = None
) -> EngagementSweepResult:
    """Scan candidates, apply the rule, act on the eligible ones."""
    global _LAST_RUN

    cap = min(
        limit or settings.automation_max_candidates_per_run,
        settings.automation_max_candidates_per_run,
        200,
    )
    scanned = repo.count_candidates(db)
    eligible = repo.list_automation_eligible_candidates(
        db,
        joining_within_days=settings.automation_joining_window_days,
        stale_after_days=settings.automation_no_interaction_days,
        limit=cap,
    )
    dedup_since_iso = (
        datetime.now(timezone.utc)
        - timedelta(days=settings.automation_dedup_days)
    ).isoformat()

    results = [
        _process_candidate(
            db, c, dry_run=dry_run, dedup_since_iso=dedup_since_iso
        )
        for c in eligible
    ]

    result = EngagementSweepResult(
        rule=RULE_ID,
        dry_run=dry_run,
        ran_at=datetime.now(timezone.utc),
        scanned=scanned,
        eligible=len(eligible),
        processed=sum(1 for r in results if r.outcome == "processed"),
        skipped=sum(1 for r in results if r.outcome == "skipped"),
        failed=sum(1 for r in results if r.outcome == "failed"),
        results=results,
    )
    _LAST_RUN = result
    logger.info(
        "engagement sweep: scanned=%d eligible=%d processed=%d skipped=%d failed=%d dry_run=%s",
        result.scanned,
        result.eligible,
        result.processed,
        result.skipped,
        result.failed,
        dry_run,
    )
    return result
