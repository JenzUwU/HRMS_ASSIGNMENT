/**
 * Display helpers that map backend enum values and raw dates to the strings
 * the reference UI shows. The backend is the source of truth; this only formats.
 */
import type { RiskLevel } from "@/types";

export const STAGE_LABEL: Record<string, string> = {
  offer_accepted: "Offer Accepted",
  welcome_sent: "Welcome Sent",
  documentation: "Documentation",
  manager_intro: "Manager Introduction",
  pre_joining: "Pre-Joining Check-in",
  joined: "Joined",
};

export const STATUS_LABEL: Record<string, string> = {
  offer_accepted: "Offer Accepted",
  active: "Active",
  joined: "Joined",
  declined: "Declined",
};

export const CHANNEL_LABEL: Record<string, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  sms: "SMS",
};

export const DOC_TYPE_LABEL: Record<string, string> = {
  aadhaar: "Aadhaar Card",
  pan: "PAN Card",
  address_proof: "Address Proof",
  bank_details: "Bank Details",
  education: "Education Documents",
  experience: "Experience Letters",
};

export const DOC_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  submitted: "Submitted",
  verified: "Verified",
  rejected: "Rejected",
};

export function riskLabel(level: string): RiskLevel {
  const map: Record<string, RiskLevel> = {
    low: "Low",
    medium: "Medium",
    high: "High",
  };
  return map[level] ?? "Low";
}

export function stageLabel(stage: string): string {
  return STAGE_LABEL[stage] ?? stage;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026-08-19" -> "19 Aug 2026". Returns "" for null. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "2026-08-19T06:35:55Z" -> "19 Aug 2026, 06:35". */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${formatDate(iso)}, ${hh}:${mm}`;
}

/** Whole-day relative label from a day count. 0 -> "Today". */
export function relativeDays(days: number | null | undefined): string {
  if (days == null) return "No activity yet";
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

/** Relative label from an ISO timestamp. */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "No activity yet";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

/** "2026-08" -> "August 2026" for the joining month filter label. */
const FULL_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export function joiningMonthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return `${FULL_MONTHS[m - 1]} ${y}`;
}
