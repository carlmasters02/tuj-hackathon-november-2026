import { notFound } from "next/navigation";
import { requireUserPage } from "@/lib/auth";
import { dec } from "@/lib/server/docs";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Editor } from "@/components/editor/Editor";
import { UUID } from "@/lib/http";

export const metadata = { title: "Write" };

export default async function WriteDocPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const parsed = UUID.safeParse(raw);
  if (!parsed.success) notFound();
  const id = parsed.data;
  const user = await requireUserPage(`/write/${id}`);
  const { data: d } = await supabaseAdmin().from("documents").select("*").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (!d) notFound();
  return <Editor docId={id} title={dec(id, "title", d.title_enc)} content={JSON.parse(dec(id, "content", d.content_enc))} lastSeq={d.last_seq} headHash={d.head_hash} />;
}
