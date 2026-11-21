import { notFound } from "next/navigation";
import { requireUserPage } from "@/lib/auth";
import { dec, docMeta, type DocRow } from "@/lib/server/docs";
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
  return (
    // the writer gets a wider canvas than the rest of the app so a full page fits beside the tools
    <div style={{ width: "min(1480px, calc(100vw - 2rem))", marginLeft: "calc((100% - min(1480px, calc(100vw - 2rem))) / 2)" }}>
      <Editor docId={id} title={dec(id, "title", d.title_enc)} content={JSON.parse(dec(id, "content", d.content_enc))} lastSeq={d.last_seq} headHash={d.head_hash} genre={d.genre} meta={docMeta(d as DocRow)} />
    </div>
  );
}
