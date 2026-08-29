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
