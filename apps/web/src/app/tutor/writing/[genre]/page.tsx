import Link from "next/link";
import { notFound } from "next/navigation";
import { genreGuide } from "@hm/shared/genres";
import { VERDICT_LABEL, type Verdict } from "@hm/shared/provenance/stats";
import { requireUserPage } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { dec } from "@/lib/server/docs";
import { HubHeader } from "@/components/Hub";
import { NewDocButton } from "@/app/write/NewDocButton";

export const metadata = { title: "Writing" };

export default async function GenrePage({ params }: { params: Promise<{ genre: string }> }) {
  const g = genreGuide((await params).genre);
  if (!g) notFound();
  const user = await requireUserPage(`/tutor/writing/${g.slug}`);
  const sb = supabaseAdmin();
  const [{ data: docs }, { data: certs }] = await Promise.all([
    sb.from("documents").select("id, title_enc, updated_at").eq("owner_id", user.id).eq("genre", g.slug).order("updated_at", { ascending: false }).limit(50),
    sb.from("certificates").select("id, doc_id, verdict").eq("owner_id", user.id).eq("kind", "writing").order("created_at", { ascending: false }),
  ]);
  const cert = new Map<string, { id: string; verdict: Verdict }>();
  for (const c of certs ?? []) if (c.doc_id && !cert.has(c.doc_id)) cert.set(c.doc_id, { id: c.id, verdict: c.verdict });

  return (
    <div>
      <HubHeader title={g.label} intro={g.promise} back={{ href: "/tutor/writing", label: "Writing" }}>
        <NewDocButton genre={g.slug} title={g.starterTitle} label={`Start a new ${g.label.toLowerCase().replace(/s$/, "")}`} />
      </HubHeader>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="your-pieces">
          <h2 id="your-pieces" className="mb-3 text-xl font-bold">Your pieces</h2>
          {(docs ?? []).length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line px-5 py-8 text-fg-dim">Nothing here yet. Start one above — the coach appears beside the page as you write.</p>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {(docs ?? []).map((d) => {
                const c = cert.get(d.id);
                return (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <Link href={`/write/${d.id}`} className="font-serif text-xl hover:underline">{dec(d.id, "title", d.title_enc)}</Link>
                    <span className="flex items-center gap-3 text-sm text-fg-faint">
                      {c && <Link href={`/verify/${c.id}`} className="chip">{VERDICT_LABEL[c.verdict]}</Link>}
                      edited {new Date(d.updated_at).toLocaleDateString()}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <aside aria-labelledby="what-the-coach-looks-for">
          <h2 id="what-the-coach-looks-for" className="mb-3 text-xl font-bold">What the coach looks for</h2>
          <dl className="space-y-4">
            {g.principles.map((p) => (
              <div key={p.title}>
                <dt className="font-bold">{p.title}</dt>
                <dd className="text-sm leading-relaxed text-fg-dim">{p.body}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </div>
  );
}
