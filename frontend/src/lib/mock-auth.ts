/**
 * PROTOTYPE AUTHENTICATION, NOT REAL SECURITY.
 *
 * This module fakes an auth backend entirely in the browser. Accounts are held
 * in localStorage in plain text and every check runs client-side. It exists so
 * the HRMS prototype can demo sign-in / sign-up / reset flows without a server.
 * Do not use any of this for a real deployment.
 */

const STORAGE_KEY = "hrms:mock-accounts";
const FAKE_LATENCY_MS = 700;

export interface MockAccount {
  fullName: string;
  email: string;
  company: string;
  password: string;
  createdAt: string;
}

/** Built-in demo login shown as the prefilled credentials on the sign-in form. */
export const DEMO_ACCOUNT = {
  email: "admin@hrms.com",
  password: "HrmsDemo#2026",
  fullName: "Admin User",
  company: "HRMS",
};

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD = 6;

function delay() {
  return new Promise((r) => setTimeout(r, FAKE_LATENCY_MS));
}

function readAccounts(): MockAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MockAccount[]) : [];
  } catch {
    return [];
  }
}

function writeAccounts(list: MockAccount[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable, prototype only, nothing to recover */
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

type Result = { ok: true } | { ok: false; error: string };

/** Fake sign-in: matches the demo account or a locally registered one. */
export async function authenticate(
  email: string,
  password: string,
): Promise<Result> {
  await delay();
  const e = normalizeEmail(email);

  if (e === DEMO_ACCOUNT.email && password === DEMO_ACCOUNT.password) {
    return { ok: true };
  }

  const match = readAccounts().find((a) => normalizeEmail(a.email) === e);
  if (match && match.password === password) return { ok: true };

  return { ok: false, error: "Invalid email or password. Please try again." };
}

/** Fake registration: stores the account locally, rejecting duplicates. */
export async function registerAccount(input: {
  fullName: string;
  email: string;
  company: string;
  password: string;
}): Promise<Result> {
  await delay();
  const e = normalizeEmail(input.email);

  if (e === DEMO_ACCOUNT.email) {
    return { ok: false, error: "That email is already registered." };
  }
  const list = readAccounts();
  if (list.some((a) => normalizeEmail(a.email) === e)) {
    return { ok: false, error: "That email is already registered." };
  }

  list.push({
    fullName: input.fullName.trim(),
    email: input.email.trim(),
    company: input.company.trim(),
    password: input.password,
    createdAt: new Date().toISOString(),
  });
  writeAccounts(list);
  return { ok: true };
}

/**
 * Fake password reset. Always resolves the same way so the UI never reveals
 * whether an email is registered.
 */
export async function requestPasswordReset(email: string): Promise<Result> {
  await delay();
  if (!EMAIL_RE.test(email.trim())) {
    return { ok: false, error: "Enter a valid email address." };
  }
  return { ok: true };
}
