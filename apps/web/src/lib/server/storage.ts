import "server-only";
import { supabaseAdmin } from "../supabase/admin";

export const BUCKETS = ["art-originals", "art-previews", "audio", "audio-previews"] as const;
export type Bucket = (typeof BUCKETS)[number];

/** Every object lives under `<ownerId>/…`, so deleting a user's files is a prefix sweep. */
export async function deleteUserFiles(userId: string): Promise<number> {
  const sb = supabaseAdmin();
  let removed = 0;
  for (const bucket of BUCKETS) {
    for (;;) {
      const { data } = await sb.storage.from(bucket).list(userId, { limit: 100 });
      if (!data?.length) break;
      const paths = data.map((o) => `${userId}/${o.name}`);
      await sb.storage.from(bucket).remove(paths);
      removed += paths.length;
      if (data.length < 100) break;
    }
  }
  return removed;
}

export async function upload(bucket: Bucket, path: string, body: Buffer, contentType = "application/octet-stream") {
  const { error } = await supabaseAdmin().storage.from(bucket).upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(`storage upload failed: ${error.message}`);
}

export async function download(bucket: Bucket, path: string): Promise<Buffer> {
  const { data, error } = await supabaseAdmin().storage.from(bucket).download(path);
  if (error || !data) throw new Error("storage download failed");
  return Buffer.from(await data.arrayBuffer());
}

export async function remove(bucket: Bucket, paths: string[]) {
  if (paths.length) await supabaseAdmin().storage.from(bucket).remove(paths);
}
