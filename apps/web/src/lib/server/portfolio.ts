import "server-only";
import { supabaseAdmin } from "../supabase/admin";

export type Kind = "art" | "writing" | "music";
export interface FeedItem {
  id: string;
  kind: Kind;
  title: string;
  owner: string;
  createdAt: string;
  width: number | null;
  height: number | null;
  verified: boolean; // has a certificate whose replay and integrity checks passed
  certId: string | null;
  likes: number;
  comments: number;
  words: number | null;
}

/** Published works of one kind, newest first, with social counts and verification status. */
export async function portfolioFeed(kind: Kind, limit = 60): Promise<FeedItem[]> {
  const sb = supabaseAdmin();
  const { data: works } = await sb
    .from("gallery_works")
    .select("id, owner_id, title, width, height, cert_id, created_at")
    .eq("kind", kind)
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!works?.length) return [];
  const ids = works.map((w) => w.id);
  const ownerIds = [...new Set(works.map((w) => w.owner_id))];
  const certIds = works.map((w) => w.cert_id).filter(Boolean) as string[];
  const [owners, likes, comments, certs] = await Promise.all([
    sb.from("profiles").select("id, username").in("id", ownerIds),
    sb.from("likes").select("work_id").in("work_id", ids),
    sb.from("comments").select("work_id").in("work_id", ids),
    certIds.length ? sb.from("certificates").select("id, verdict, payload").in("id", certIds) : Promise.resolve({ data: [] as { id: string; verdict: string; payload: any }[] }),
  ]);
  const name = new Map((owners.data ?? []).map((o) => [o.id, o.username]));
  const count = (rows: { work_id: string }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.work_id, (m.get(r.work_id) ?? 0) + 1);
    return m;
  };
  const likeN = count(likes.data);
  const commentN = count(comments.data);
  const cert = new Map((certs.data ?? []).map((c) => [c.id, c]));
  return works.map((w) => {
    const c = w.cert_id ? cert.get(w.cert_id) : undefined;
    return {
      id: w.id,
      kind,
      title: w.title,
      owner: name.get(w.owner_id) ?? "unknown",
      createdAt: w.created_at,
      width: w.width,
      height: w.height,
      verified: c?.verdict === "human_verified",
      certId: w.cert_id,
      likes: likeN.get(w.id) ?? 0,
      comments: commentN.get(w.id) ?? 0,
      words: c?.payload?.stats?.finalWords ?? null,
    };
  });
}

export async function portfolioCounts(): Promise<Record<Kind, { total: number; verified: number }>> {
  const sb = supabaseAdmin();
  const { data } = await sb.from("gallery_works").select("kind, cert_id").eq("published", true);
  const certIds = (data ?? []).map((r) => r.cert_id).filter(Boolean) as string[];
  const sealed = new Set(certIds.length ? ((await sb.from("certificates").select("id").in("id", certIds).eq("verdict", "human_verified")).data ?? []).map((c) => c.id) : []);
  const out: Record<Kind, { total: number; verified: number }> = { art: { total: 0, verified: 0 }, writing: { total: 0, verified: 0 }, music: { total: 0, verified: 0 } };
  for (const r of data ?? []) {
    const k = r.kind as Kind;
    out[k].total++;
    if (r.cert_id && sealed.has(r.cert_id)) out[k].verified++;
  }
  return out;
}
