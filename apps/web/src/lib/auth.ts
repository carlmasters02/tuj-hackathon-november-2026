import "server-only";
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { HttpError } from "./http";
import { supabaseServer } from "./supabase/server";
import { supabaseAdmin } from "./supabase/admin";

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  is_public: boolean;
  leaderboard_opt_in: boolean;
  /** false for Google sign-ups until they pick a username on /welcome */
  username_chosen: boolean;
}

/**
 * The verified current user. Uses auth.getUser(), which validates the JWT with Supabase Auth on
 * every call — never getSession(), whose cookie contents are client-controlled.
 */
export async function currentUser(): Promise<User | null> {
  try {
    const sb = await supabaseServer();
    const { data, error } = await sb.auth.getUser();
    if (error) return null;
    return data.user;
  } catch {
    return null;
  }
}

/** For route handlers: throws 401 when signed out. */
export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) throw new HttpError(401, "Please log in to continue.");
  return u;
}

/**
 * For pages: redirects to /login when signed out, and to /welcome until a Google sign-up has
 * chosen its username.
 */
export async function requireUserPage(next = "/dashboard"): Promise<User> {
  const u = await currentUser();
  if (!u) redirect(process.env.HM_DEMO_MODE === "true" ? `/auth/demo?next=${encodeURIComponent(next)}` : `/login?next=${encodeURIComponent(next)}`);
  const p = await profileOf(u.id);
  if (p && !p.username_chosen) redirect(`/welcome?next=${encodeURIComponent(next)}`);
  return u;
}

export async function profileOf(userId: string): Promise<Profile | null> {
  const { data } = await supabaseAdmin().from("profiles").select("id, username, display_name, bio, is_public, leaderboard_opt_in, username_chosen").eq("id", userId).maybeSingle();
  return (data as Profile) ?? null;
}
