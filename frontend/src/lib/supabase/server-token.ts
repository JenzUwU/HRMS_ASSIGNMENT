import "server-only";

import { registerServerTokenGetter } from "@/lib/api-client";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Side-effect module: teaches the shared API client how to read the Supabase
 * access token from the request cookies during server rendering. Imported once
 * from the root layout (a Server Component); never reaches the browser bundle.
 */
registerServerTokenGetter(async () => {
  try {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
});
