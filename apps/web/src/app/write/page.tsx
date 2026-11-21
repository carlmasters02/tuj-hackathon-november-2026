import Link from "next/link";
import { requireUserPage } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { dec } from "@/lib/server/docs";
import { NewDocButton } from "./NewDocButton";
import { VERDICT_LABEL, type Verdict } from "@hm/shared/provenance/stats";

export const metadata = { title: "Write" };

export default async function WritePage() {
  const user = await requireUserPage("/write");
  const sb = supabaseAdmin();
  const [{ data: docs }, { data: certs }] = await Promise.all([
    sb.from("documents").select("id, title_enc, status, updated_at").eq("owner_id", user.id).order("updated_at", { ascending: false }).limit(200),
    sb.from("certificates").select("id, doc_id, verdict, created_at").eq("owner_id", user.id).order("created_at", { ascending: false }),
  ]);
  const latestCert = new Map<string, { id: string; verdict: Verdict }>();
  for (const c of certs ?? []) if (c.doc_id && !latestCert.has(c.doc_id)) latestCert.set(c.doc_id, { id: c.id, verdict: c.verdict });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h-page">Written here</h1>
          <p className="mt-1 max-w-2xl text-sm text-paper-dim">Drafts are encrypted at rest. Every edit is hash-chained and checked by the server as you type; finalize to get a signed certificate with a public replay.</p>
        </div>
        <NewDocButton />
      </div>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {(docs ?? []).length === 0 && <li className="p-6 text-sm text-paper-faint">No documents yet.</li>}
        {(docs ?? []).map((d) => {
          const cert = latestCert.get(d.id);
          return (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <Link href={`/write/${d.id}`} className="font-serif text-lg hover:underline">{dec(d.id, "title", d.title_enc)}</Link>
              <div className="flex items-center gap-3 text-xs text-paper-faint">
                {cert && <Link href={`/verify/${cert.id}`} className="chip hover:text-paper">{VERDICT_LABEL[cert.verdict]} ↗</Link>}
                <span>edited {new Date(d.updated_at).toLocaleString()}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
