/**
 * Hand-off of an AI-generated draft from the candidate AI panel to the
 * Communication email composer. Kept in sessionStorage (not the URL) so the
 * draft body, which can contain candidate details, never appears in a query
 * string. One-shot: the composer consumes and clears it.
 */

const KEY = "hrms:ai-compose-draft";

export interface AiComposeDraft {
  slug: string;
  subject: string | null;
  body: string;
}

export function stashAiDraft(draft: AiComposeDraft): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    /* storage unavailable, the composer just opens empty */
  }
}

/** Read and remove the stashed draft, but only if it is for this candidate. */
export function takeAiDraft(slug: string): AiComposeDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AiComposeDraft;
    if (parsed.slug !== slug) return null;
    sessionStorage.removeItem(KEY);
    return parsed;
  } catch {
    return null;
  }
}
