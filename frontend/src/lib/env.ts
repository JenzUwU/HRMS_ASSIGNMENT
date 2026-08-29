/**
 * Central access point for public runtime config.
 * Only NEXT_PUBLIC_* vars are readable in the browser.
 *
 * In a containerized deployment the browser and the Next.js server reach the
 * API on different hostnames (localhost:8000 vs backend:8000). When
 * API_INTERNAL_BASE_URL is set it is used for server-side fetches only; the
 * browser always uses NEXT_PUBLIC_API_BASE_URL.
 */
const publicApiBase =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export const env = {
  apiBaseUrl:
    typeof window === "undefined"
      ? (process.env.API_INTERNAL_BASE_URL ?? publicApiBase)
      : publicApiBase,
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "HRMS Post Offer Engagement",
} as const;
