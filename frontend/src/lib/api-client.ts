import { env } from "@/lib/env";

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
};

function buildUrl(
  path: string,
  params?: RequestOptions["params"],
): string {
  const base = env.apiBaseUrl.replace(/\/$/, "");
  const url = new URL(`${base}${path.startsWith("/") ? path : `/${path}`}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * On the server the token comes from the request cookies. That resolver lives
 * in a server-only module (it imports next/headers) and registers itself here
 * so this file stays safe to bundle for the browser.
 */
type TokenGetter = () => Promise<string | null>;
let serverTokenGetter: TokenGetter | null = null;
export function registerServerTokenGetter(fn: TokenGetter) {
  serverTokenGetter = fn;
}

/**
 * Resolve the current Supabase access token on either side of the boundary.
 * Returns null when there is no session (public pages, signed out).
 */
async function accessToken(): Promise<string | null> {
  try {
    if (typeof window === "undefined") {
      return serverTokenGetter ? await serverTokenGetter() : null;
    }
    const { supabaseBrowser } = await import("@/lib/supabase/client");
    const { data } = await supabaseBrowser().auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Thin typed wrapper over fetch. Backend is FastAPI. Attaches the verified
 * Supabase bearer token so protected API routes accept the request.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, params, headers, ...rest } = options;

  const token = await accessToken();

  const res = await fetch(buildUrl(path, params), {
    // This is an internal tool reading live data. Never serve a stale cache.
    cache: "no-store",
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const isJson = res.headers
    .get("content-type")
    ?.includes("application/json");
  const payload = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message =
      (isJson && (payload?.detail || payload?.message)) ||
      `Request failed with status ${res.status}`;
    throw new ApiError(res.status, message, payload);
  }

  return payload as T;
}
