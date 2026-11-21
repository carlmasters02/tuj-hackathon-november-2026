import "server-only";
import { mediaUrl } from "@hm/shared/gallery/signedUrl";
import { keyBytes } from "../env";
import { HttpError } from "../http";
import { supabaseAdmin } from "../supabase/admin";
import { decryptString } from "../crypto";
import { remove } from "./storage";

export interface WorkRow {
  id: string;
  owner_id: string;
  kind: "art" | "writing" | "music";
  title: string;
  description: string | null;
  sha256: string | null;
  dhash: string | null;
  storage_key_enc: string | null;
  preview_key: string | null;
  mime: string | null;
  width: number | null;
  height: number | null;
  cert_id: string | null;
  published: boolean;
  created_at: string;
}

/** A work the viewer may see: published, or their own. */
export async function viewableWork(id: string, viewerId: string): Promise<WorkRow> {
  const { data } = await supabaseAdmin().from("gallery_works").select("*").eq("id", id).maybeSingle();
  if (!data || (!data.published && data.owner_id !== viewerId)) throw new HttpError(404, "Not found");
  return data as WorkRow;
}

export function signedMediaUrl(workId: string, viewerId: string, kind: "art" | "music" = "art") {
  return mediaUrl(keyBytes("HM_MEDIA_HMAC_KEY"), workId, viewerId, undefined, kind === "music" ? "/api/audio" : "/api/media");
}

export async function deleteWorkFiles(w: WorkRow) {
  const original = w.storage_key_enc ? decryptString(w.storage_key_enc, `work:${w.id}:key`) : null;
  if (w.kind === "art") {
    if (original) await remove("art-originals", [original]);
    if (w.preview_key) await remove("art-previews", [w.preview_key]);
  } else if (w.kind === "music") {
    if (original) await remove("audio", [original]);
    if (w.preview_key) await remove("audio-previews", [w.preview_key]);
  }
}

// in-memory bulk-download detector: >300 media fetches in 10 minutes flags the account
const hits = new Map<string, number[]>();
export async function noteMediaFetch(userId: string) {
  const now = Date.now();
  const arr = (hits.get(userId) ?? []).filter((t) => now - t < 600_000);
  arr.push(now);
  hits.set(userId, arr);
  if (arr.length === 301) {
    console.warn("[media] bulk download pattern; flagging account");
    await supabaseAdmin().from("profiles").update({ flagged_bulk: true }).eq("id", userId);
  }
}
