/**
 * Central access point for public runtime config.
 * Only NEXT_PUBLIC_* vars are readable in the browser.
 */
export const env = {
  apiBaseUrl:
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1",
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "HRMS Post Offer Engagement",
} as const;
