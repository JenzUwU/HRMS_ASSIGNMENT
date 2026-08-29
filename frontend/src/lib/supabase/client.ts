import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Browser-side Supabase client. Uses the publishable/anon key only. The session
 * is stored in cookies (via @supabase/ssr) so the Next.js middleware and server
 * components can read it too. Auto-refreshes the access token.
 */
export function supabaseBrowser() {
  return createBrowserClient(url, anonKey);
}

export const supabaseConfigured = Boolean(url && anonKey);
