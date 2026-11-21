/**
 * Authorization isolation against a REAL Supabase project (RLS + grants).
 * Skipped unless NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
 * are set (pnpm test:authz loads apps/web/.env.local). Creates two throwaway users and deletes them.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const envFile = join(__dirname, "..", ".env.local");
if (existsSync(envFile) && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = !!(URL_ && ANON && SERVICE);

describe.skipIf(!enabled)("RLS isolation between two users", () => {
  let admin: SupabaseClient;
  let A: { id: string; c: SupabaseClient };
  let B: { id: string; c: SupabaseClient };
  let docA: string;
  const pw = "isolation test passphrase " + randomUUID();
  const tag = randomUUID().slice(0, 8);

  async function mkUser(name: string) {
    const email = `${name}-${tag}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { username: `${name}_${tag}`.slice(0, 20) } });
    if (error) throw error;
    const c = createClient(URL_!, ANON!, { auth: { persistSession: false } });
    const { error: e2 } = await c.auth.signInWithPassword({ email, password: pw });
    if (e2) throw e2;
    return { id: data.user.id, c };
  }

  beforeAll(async () => {
    admin = createClient(URL_!, SERVICE!, { auth: { persistSession: false } });
    A = await mkUser("ua");
    B = await mkUser("ub");
    docA = randomUUID();
    await admin.from("documents").insert({ id: docA, owner_id: A.id, title_enc: "x", content_enc: "x", text_enc: "x" });
    await admin.from("doc_event_batches").insert({ doc_id: docA, session_id: randomUUID(), seq_start: 0, seq_end: 0, events_json: [], head_hash: "0".repeat(64) });
    await admin.from("tutor_progress").insert({ user_id: A.id, problem_id: "lin-1" });
    await admin.from("tracker_daily").insert({ user_id: A.id, date: "2026-11-21", domain: "claude.ai", seconds: 600 });
    await admin.from("points_ledger").insert({ user_id: A.id, reason: "math", ref: "lin-1", points: 15 });
    await admin.from("gallery_works").insert({ owner_id: A.id, kind: "art", title: "draft", published: false });
    await admin.from("extension_tokens").insert({ user_id: A.id, token_hash: "h-" + tag });
    await admin.storage.from("art-originals").upload(`${A.id}/secret.bin`, Buffer.from("secret"));
  }, 60_000);

  afterAll(async () => {
    if (!admin) return;
    await admin.storage.from("art-originals").remove([`${A?.id}/secret.bin`]);
    for (const u of [A, B]) if (u) await admin.auth.admin.deleteUser(u.id);
  });

  it("A can read A's own rows", async () => {
    expect((await A.c.from("documents").select("id").eq("id", docA)).data).toHaveLength(1);
    expect((await A.c.from("tracker_daily").select("*")).data).toHaveLength(1);
  });

  it("B cannot read A's drafts, events, tracker data, tutor progress, points or unpublished works", async () => {
    for (const t of ["documents", "doc_event_batches", "tracker_daily", "tutor_progress", "points_ledger", "extension_tokens"]) {
      const { data } = await B.c.from(t).select("*");
      expect(data ?? [], t).toHaveLength(0);
    }
    expect((await B.c.from("gallery_works").select("*").eq("owner_id", A.id)).data ?? []).toHaveLength(0);
  });

  it("B cannot modify or delete A's rows", async () => {
    await B.c.from("documents").update({ title_enc: "pwned" }).eq("id", docA);
    await B.c.from("documents").delete().eq("id", docA);
    const { data } = await admin.from("documents").select("title_enc").eq("id", docA).single();
    expect(data!.title_enc).toBe("x");
  });

  it("nobody can write tamper-sensitive tables directly, not even for themselves", async () => {
    const r1 = await A.c.from("doc_event_batches").insert({ doc_id: docA, session_id: randomUUID(), seq_start: 1, seq_end: 1, events_json: [], head_hash: "f".repeat(64) });
    const r2 = await A.c.from("points_ledger").insert({ user_id: A.id, reason: "math", ref: "fake", points: 999 });
    const r3 = await A.c.from("certificates").insert({ id: randomUUID(), owner_id: A.id, title: "t", verdict: "human_verified", payload: {}, signature: "s", public_key: "k", events_json: [] });
    const r4 = await A.c.from("tracker_daily").insert({ user_id: A.id, date: "2026-11-20", domain: "x.com", seconds: 0 });
    for (const r of [r1, r2, r3, r4]) expect(r.error).not.toBeNull();
  });

  it("users can't change server-controlled profile columns", async () => {
    const { error } = await A.c.from("profiles").update({ username: "hijack" }).eq("id", A.id);
    expect(error).not.toBeNull();
    const flag = await A.c.from("profiles").update({ username_chosen: false }).eq("id", A.id);
    expect(flag.error).not.toBeNull();
    const flagged = await A.c.from("profiles").update({ flagged_bulk: false }).eq("id", A.id);
    expect(flagged.error).not.toBeNull();
    const ok = await A.c.from("profiles").update({ bio: "hi" }).eq("id", A.id);
    expect(ok.error).toBeNull();
  });

  it("extension token hashes are not readable even by their owner", async () => {
    const { error } = await A.c.from("extension_tokens").select("token_hash");
    expect(error).not.toBeNull();
  });

  it("private storage buckets are closed to users — even the owner", async () => {
    const own = await A.c.storage.from("art-originals").download(`${A.id}/secret.bin`);
    const other = await B.c.storage.from("art-originals").download(`${A.id}/secret.bin`);
    expect(own.error).not.toBeNull();
    expect(other.error).not.toBeNull();
    const up = await B.c.storage.from("art-previews").upload(`${B.id}/x.bin`, Buffer.from("x"));
    expect(up.error).not.toBeNull();
  });

  it("rate-limit buckets and login attempts are closed to clients", async () => {
    for (const t of ["rate_limits", "login_attempts"]) {
      const { data } = await A.c.from(t).select("*");
      expect(data ?? [], t).toHaveLength(0);
    }
    const rpc = await A.c.rpc("hm_take_token", { p_key: "x", p_capacity: 1, p_window_seconds: 1 });
    expect(rpc.error).not.toBeNull();
  });

  it("anonymous visitors see only public data", async () => {
    const anon = createClient(URL_!, ANON!, { auth: { persistSession: false } });
    expect((await anon.from("documents").select("*")).data ?? []).toHaveLength(0);
    expect((await anon.from("tracker_daily").select("*")).data ?? []).toHaveLength(0);
  });
});
