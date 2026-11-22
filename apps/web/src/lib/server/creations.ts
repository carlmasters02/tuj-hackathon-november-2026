import "server-only";
import type { CreationBatch, CreationKind } from "@hm/shared/creation";
import { HttpError } from "../http";
import { supabaseAdmin } from "../supabase/admin";

export interface CreationRow {
  id: string;
  owner_id: string;
  kind: CreationKind;
  title: string;
  status: "draft" | "finalized";
  first_session_id: string | null;
  head_hash: string | null;
  last_seq: number;
}

export async function ownedCreation(id: string, userId: string): Promise<CreationRow> {
  const { data } = await supabaseAdmin().from("creations").select("*").eq("id", id).eq("owner_id", userId).maybeSingle();
  if (!data) throw new HttpError(404, "We couldn't find that. It may have been deleted.");
  return data as CreationRow;
}

export async function loadCreationBatches(id: string): Promise<CreationBatch[]> {
  const { data, error } = await supabaseAdmin()
    .from("creation_event_batches")
    .select("session_id, seq_start, seq_end, events_json, head_hash, received_at")
    .eq("creation_id", id)
    .order("seq_start", { ascending: true })
    .limit(5000);
  if (error) throw error;
  return (data ?? []).map((b) => ({ sessionId: b.session_id, seqStart: b.seq_start, seqEnd: b.seq_end, events: b.events_json, headHash: b.head_hash, receivedAt: b.received_at }));
}

export interface CreationSummary {
  id: string;
  title: string;
  status: "draft" | "finalized";
  updatedAt: string;
  events: number;
  workId: string | null;
  verdict: string | null;
}

/** The viewer's studio drawings or compositions, newest first, with the published work if finished. */
export async function myCreations(userId: string, kind: CreationKind): Promise<CreationSummary[]> {
  const sb = supabaseAdmin();
  const { data } = await sb.from("creations").select("id, title, status, updated_at, last_seq").eq("owner_id", userId).eq("kind", kind).order("updated_at", { ascending: false }).limit(60);
  const rows = data ?? [];
  const done = rows.filter((r) => r.status === "finalized").map((r) => r.id);
  const certs = done.length ? (await sb.from("certificates").select("id, verdict, payload->>docId").eq("owner_id", userId).eq("kind", kind).in("payload->>docId", done)).data ?? [] : [];
  const certByDoc = new Map(certs.map((c: any) => [c.docId as string, c]));
  const certIds = certs.map((c: any) => c.id);
  const works = certIds.length ? (await sb.from("gallery_works").select("id, cert_id").in("cert_id", certIds)).data ?? [] : [];
  const workByCert = new Map(works.map((w) => [w.cert_id, w.id]));
  return rows.map((r) => {
    const c = certByDoc.get(r.id);
    return { id: r.id, title: r.title, status: r.status, updatedAt: r.updated_at, events: r.last_seq + 1, workId: c ? (workByCert.get(c.id) ?? null) : null, verdict: c?.verdict ?? null };
  });
}

/** Everything the studio/composer needs to resume a draft. */
export async function creationForEditing(id: string, userId: string) {
  const { creationStats } = await import("@hm/shared/creation");
  const row = await ownedCreation(id, userId).catch(() => null);
  if (!row) return null;
  const batches = await loadCreationBatches(id);
  const stats = batches.length ? creationStats(row.kind, batches).stats : null;
  return { row, events: batches.flatMap((b) => b.events), prior: { count: (row.kind === "art" ? stats?.strokes : stats?.noteEdits) ?? 0, activeSeconds: stats?.activeSeconds ?? 0 } };
}
