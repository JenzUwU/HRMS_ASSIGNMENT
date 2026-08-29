/**
 * Unit tests for the AI-draft hand-off. No test framework is installed; these
 * use the Node built-in runner:  npm run test:utils
 *
 * The invariant under test: a stashed AI draft is only ever consumed by the
 * candidate it was generated for. A different candidate's Communication view
 * must never load it.
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { stashAiDraft, takeAiDraft } from "./ai-compose.ts";

// Minimal in-memory sessionStorage for the Node environment.
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? (this.m.get(k) as string) : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}

beforeEach(() => {
  (globalThis as unknown as { sessionStorage: MemStorage }).sessionStorage =
    new MemStorage();
});

test("takeAiDraft returns the draft for the matching candidate slug", () => {
  stashAiDraft({ slug: "ajay-krishna", subject: "Welcome", body: "Hi Ajay" });
  const d = takeAiDraft("ajay-krishna");
  assert.equal(d?.body, "Hi Ajay");
  assert.equal(d?.subject, "Welcome");
});

test("takeAiDraft returns null for a different candidate", () => {
  stashAiDraft({ slug: "ajay-krishna", subject: "Welcome", body: "Hi Ajay" });
  assert.equal(takeAiDraft("janani"), null);
});

test("a mismatched read does NOT consume the stash", () => {
  stashAiDraft({ slug: "ajay-krishna", subject: null, body: "Hi Ajay" });
  assert.equal(takeAiDraft("janani"), null); // wrong candidate
  assert.equal(takeAiDraft("ajay-krishna")?.body, "Hi Ajay"); // still there
});

test("a matching read consumes the stash (one-shot)", () => {
  stashAiDraft({ slug: "ajay-krishna", subject: null, body: "Hi Ajay" });
  assert.equal(takeAiDraft("ajay-krishna")?.body, "Hi Ajay");
  assert.equal(takeAiDraft("ajay-krishna"), null); // gone
});

test("no stash -> null", () => {
  assert.equal(takeAiDraft("anyone"), null);
});

test("switching candidates does not leak the previous draft", () => {
  stashAiDraft({ slug: "janani", subject: "A", body: "for Janani" });
  // HR opens a different candidate's Communication view:
  assert.equal(takeAiDraft("ajay-krishna"), null);
  // then re-stashes for the new candidate and opens it:
  stashAiDraft({ slug: "ajay-krishna", subject: "B", body: "for Ajay" });
  const d = takeAiDraft("ajay-krishna");
  assert.equal(d?.body, "for Ajay");
  assert.equal(d?.subject, "B");
});
