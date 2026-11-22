import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, assertSameOrigin, HttpError, json, parseJson, rateLimit } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

const Body = z.object({ certId: z.string().uuid() }).strict();

/** Only documents with a verified creation record owned by the caller can be published. */
export const POST = api(async (req: NextRequest) => {
  assertSameOrigin(req);
  const user = await requireUser();
  await rateLimit("api", user.id);
  const { certId } = await parseJson(req, Body, 1_000);
  const sb = supabaseAdmin();
  const { data: cert } = await sb.from("certificates").select("id, owner_id, verdict, title").eq("id", certId).maybeSingle();
  if (!cert || cert.owner_id !== user.id) throw new HttpError(404, "We couldn't find that certificate. Check the link.");
  if (cert.verdict !== "human_verified") throw new HttpError(400, "Only writing with a verified creation record can be published.");
  const { data: existing } = await sb.from("gallery_works").select("id").eq("cert_id", certId).maybeSingle();
  if (existing) return json({ id: existing.id });
  const { data, error } = await sb.from("gallery_works").insert({ owner_id: user.id, kind: "writing", title: cert.title.slice(0, 120) || "Untitled", cert_id: certId, published: true }).select("id").single();
  if (error) throw error;
  return json({ id: data.id });
});
