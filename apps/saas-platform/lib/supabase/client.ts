import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/lib/env.client";

export function createClient() {
  if (!clientEnv.NEXT_PUBLIC_SUPABASE_URL || !clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error("Le stockage Supabase n’est pas configuré.");
  return createBrowserClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
