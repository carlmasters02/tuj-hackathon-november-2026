import "server-only";
import { parseMeta } from "@hm/shared/docMeta";
import { decryptString, encryptString } from "../crypto";
import { HttpError } from "../http";
import { supabaseAdmin } from "../supabase/admin";

export interface DocRow {
  id: string;
  owner_id: string;
  title_enc: string;
  content_enc: string;
  text_enc: string;
  meta_enc: string | null;
  genre?: string;
  status: "draft" | "finalized";
  first_session_id: string | null;
  head_hash: string | null;
  last_seq: number;
  credited_seconds: number;
  created_at: string;
  updated_at: string;
}

// AAD binds each ciphertext to its document and field, so ciphertexts can't be swapped between rows.
export const enc = (docId: string, field: "title" | "content" | "text" | "meta", v: string) => encryptString(v, `doc:${docId}:${field}`);
export const dec = (docId: string, field: "title" | "content" | "text" | "meta", v: string) => decryptString(v, `doc:${docId}:${field}`);

/** Loads a document only if `userId` owns it; 404 otherwise (no existence oracle). */
export async function ownedDoc(docId: string, userId: string): Promise<DocRow> {
  const { data, error } = await supabaseAdmin().from("documents").select("*").eq("id", docId).eq("owner_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "We couldn't find that document. It may have been deleted.");
  return data as DocRow;
}

/** The document's settings (page setup, sources, comments…), decrypted and validated. */
export function docMeta(d: DocRow) {
  return parseMeta(d.meta_enc ? JSON.parse(dec(d.id, "meta", d.meta_enc)) : {});
}
