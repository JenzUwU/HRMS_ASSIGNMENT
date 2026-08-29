/**
 * Shared domain types. Kept framework free so both server components
 * and client components can import them.
 */

export type RiskLevel = "High" | "Medium" | "Low";

export type EngagementStage =
  | "Offer Accepted"
  | "Welcome Sent"
  | "Documentation"
  | "Manager Introduction"
  | "Pre-Joining Check-in"
  | "Joined";

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
