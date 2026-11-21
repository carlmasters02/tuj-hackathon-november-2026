import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "../env";

/** Per-request Supabase client acting as the signed-in user (RLS applies). */
export async function supabaseServer() {
  const store = await cookies();
  const e = env();
  return createServerClient(e.NEXT_PUBLIC_SUPABASE_URL, e.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, { ...options, sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production" });
        } catch {
          // called from a Server Component: middleware refreshes the session instead
        }
      },
    },
  });
}
