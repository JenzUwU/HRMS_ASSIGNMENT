/**
 * Maps backend errors to short, user-facing copy. Never surfaces stack traces
 * or raw backend messages. Backend error envelope: { detail, code }.
 */
import { ApiError } from "@/lib/api-client";

function code(e: unknown): string | undefined {
  if (e instanceof ApiError && e.details && typeof e.details === "object") {
    return (e.details as { code?: string }).code;
  }
  return undefined;
}

export function aiErrorMessage(e: unknown): string {
  const c = code(e);
  if (c === "ai_not_configured") return "AI is not configured right now.";
  if (c === "ai_invalid_output")
    return "AI returned an invalid result. Please try again.";
  if (c === "ai_upstream_error")
    return "AI service is temporarily unavailable. Please try again.";
  if (e instanceof ApiError) {
    if (e.status === 503) return "AI is not configured right now.";
    if (e.status === 429 || e.status === 502)
      return "AI service is temporarily unavailable. Please try again.";
  }
  return "Could not reach the AI service. Please try again.";
}

export function mutationErrorMessage(e: unknown, fallback = "Something went wrong."): string {
  if (e instanceof ApiError) {
    if (e.status === 404) return "That record no longer exists. Refresh and try again.";
    if (e.status === 422) return "Please check the form and try again.";
    if (e.status === 503) return "The service is unavailable right now.";
    if (e.status >= 500) return "The server had a problem. Please try again.";
    if (typeof e.message === "string" && e.message && e.status < 500) return e.message;
  }
  return fallback;
}
