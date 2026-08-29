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
 * Thin typed wrapper over fetch. Backend is FastAPI.
 * Swap or extend here when auth headers or Supabase session are added later.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, params, headers, ...rest } = options;

  const res = await fetch(buildUrl(path, params), {
    ...rest,
    headers: {
      "Content-Type": "application/json",
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
