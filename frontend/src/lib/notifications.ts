/**
 * Mock notification feed for the HRMS prototype.
 *
 * These entries are derived from the same candidate / action / communication
 * data the rest of the app already shows. There is no notification backend:
 * read / unread state is held in component state (see NotificationBell). When a
 * real feed exists, replace `MOCK_NOTIFICATIONS` with fetched data of the same
 * shape and the UI keeps working unchanged.
 */

export type NotificationKind = "attention" | "reminder" | "action";

export interface AppNotification {
  /** Stable id, used as the read/unread key. */
  id: string;
  /** Primary line, e.g. "Aisha Jha needs attention". */
  title: string;
  /** Secondary line explaining why this notification exists. */
  reason: string;
  /** Existing in-app route this notification points at. */
  href: string;
  /** Initials for the avatar. */
  initials: string;
  /** Drives the accent dot / grouping. */
  kind: NotificationKind;
  /** Pre-formatted relative time label. */
  timeLabel: string;
}

import type { RecruiterNotification } from "@/lib/api";

const KIND_MAP: Record<string, NotificationKind> = {
  high_risk: "attention",
  inbound_reply: "action",
  automation_task: "reminder",
};

/** Relative time label from an ISO timestamp. */
function relTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? "1d ago" : `${days}d ago`;
}

/** Map a backend recruiter notification to the bell's display shape. */
export function toAppNotification(n: RecruiterNotification): AppNotification {
  const slug = n.candidate_slug;
  return {
    id: n.id,
    title: n.title,
    reason:
      n.recommended_action ?? n.reason ?? "Candidate needs recruiter attention",
    href: slug
      ? n.kind === "inbound_reply"
        ? `/communication?candidate=${slug}`
        : `/candidates/${slug}`
      : "/notifications",
    initials: n.candidate_initials ?? "?",
    kind: KIND_MAP[n.kind] ?? "attention",
    timeLabel: relTime(n.occurred_at),
  };
}

export const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: "aisha-jha-onboarding-resources",
    title: "Aisha Jha needs attention",
    reason: "Share onboarding resources",
    href: "/engagement-journey?candidate=aisha-jha",
    initials: "AJ",
    kind: "attention",
    timeLabel: "2h ago",
  },
  {
    id: "sanya-menon-document-reminder",
    title: "Sanya Menon",
    reason: "Document submission reminder",
    href: "/communication?candidate=sanya-menon",
    initials: "SM",
    kind: "reminder",
    timeLabel: "5h ago",
  },
  {
    id: "ira-kulkarni-followup",
    title: "Ira Kulkarni",
    reason: "Upcoming follow-up action",
    href: "/candidates/ira-kulkarni",
    initials: "IK",
    kind: "action",
    timeLabel: "1d ago",
  },
];
