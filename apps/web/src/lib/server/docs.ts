import "server-only";
import { decryptString, encryptString } from "../crypto";
import { HttpError } from "../http";
import { supabaseAdmin } from "../supabase/admin";

export interface DocRow {
  id: string;
  owner_id: string;
  title_enc: string;
  content_enc: string;
  text_enc: string;
  status: "draft" | "finalized";
  first_session_id: string | null;
  head_hash: string | null;
  last_seq: number;
  credited_seconds: number;
  created_at: string;
  updated_at: string;
}

// AAD binds each ciphertext to its document and field, so ciphertexts can't be swapped between rows.
export const enc = (docId: string, field: "title" | "content" | "text", v: string) => encryptString(v, `doc:${docId}:${field}`);
export const dec = (docId: string, field: "title" | "content" | "text", v: string) => decryptString(v, `doc:${docId}:${field}`);

/** Loads a document only if `userId` owns it; 404 otherwise (no existence oracle). */
export async function ownedDoc(docId: string, userId: string): Promise<DocRow> {
  const { data, error } = await supabaseAdmin().from("documents").select("*").eq("id", docId).eq("owner_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "Document not found");
  return data as DocRow;
}
