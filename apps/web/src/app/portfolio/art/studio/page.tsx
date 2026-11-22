import Link from "next/link";
import { DeleteItemButton } from "@/components/DeleteItemButton";
import { requireUserPage } from "@/lib/auth";
import { myCreations } from "@/lib/server/creations";
import { HumanSeal } from "@/components/HumanSeal";
import { NewCreationButton } from "@/components/studio/NewCreationButton";

export const metadata = { title: "Drawing studio" };

export default async function StudioIndex() {
  const user = await requireUserPage("/portfolio/art/studio");
  const items = await myCreations(user.id, "art");

  const panel = "rounded-xl border-[1.5px] border-[#E9D68A] bg-white p-5 shadow-[0_5px_15px_rgba(91,77,39,0.09)] sm:p-6";

  return (
    <main className="mx-auto max-w-5xl space-y-7 pb-12">
      <header>
        <Link href="/portfolio/art" className="inline-flex items-center gap-1 text-sm font-semibold text-fg-dim transition hover:text-fg">
          <span aria-hidden="true">←</span> Art
        </Link>
        <h1 className="mt-5 font-display text-[clamp(2.3rem,5vw,3.7rem)] font-semibold leading-tight tracking-tight text-fg">Drawing studio</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-fg-dim">
          Every stroke you make here is recorded and timestamped by the server. Finish a non-empty drawing and the server replays its whole history to verify the creation record—there is no stroke-count or time minimum.
        </p>
      </header>

      <section aria-labelledby="choose-art-heading">
        <h2 id="choose-art-heading" className="mb-3 font-display text-xl font-semibold text-fg">Start something new</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className={panel}>
            <div className="mb-2 flex items-center gap-3">
              <span aria-hidden="true" className="inline-flex h-9 w-9 items-center justify-center border border-[#E9D68A] bg-[#FFFBF2]">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m4 20 5-2 11-11-3-3L6 15l-2 5Z"/><path d="m14 7 3 3"/></svg>
              </span>
              <h3 className="font-display text-2xl font-semibold text-fg">Digital Art</h3>
            </div>
            <p className="mb-5 min-h-10 text-sm leading-relaxed text-fg-dim">Draw freely with pens, markers, colours, and your own brush strokes.</p>
            <NewCreationButton kind="art" mode="digital" label="New digital drawing →" />
          </div>
          <div className={panel}>
            <div className="mb-2 flex items-center gap-3">
              <span aria-hidden="true" className="inline-flex h-9 w-9 items-center justify-center border border-[#E9D68A] bg-[#FFFBF2]">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              </span>
              <h3 className="font-display text-2xl font-semibold text-fg">Pixel Art</h3>
            </div>
            <p className="mb-5 min-h-10 text-sm leading-relaxed text-fg-dim">Create with precise square pixels, one small piece at a time.</p>
            <NewCreationButton kind="art" mode="pixel" label="New pixel drawing →" />
          </div>
        </div>
      </section>

      <section aria-labelledby="drawings-heading">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 id="drawings-heading" className="font-display text-xl font-semibold text-fg">Your drawings</h2>
          <span className="text-xs tabular-nums text-fg-dim">{items.length} {items.length === 1 ? "piece" : "pieces"}</span>
        </div>
        {items.length ? (
          <ul className="space-y-3">
            {items.map((c) => {
              const href = c.status === "draft" ? `/portfolio/art/studio/${c.id}` : c.workId ? `/portfolio/work/${c.workId}` : `/portfolio/art/studio/${c.id}`;
              return (
                <li key={c.id} className="flex min-h-[82px] items-center gap-2 rounded-xl border-[1.5px] border-[#E9D68A] bg-white pr-3 shadow-[0_4px_12px_rgba(91,77,39,0.06)] transition hover:border-[#D4BD62]">
                  <Link href={href} className="group flex min-w-0 flex-1 items-center justify-between gap-4 self-stretch rounded-xl py-4 pl-5 pr-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-fg">{c.title}</h3>
                      <p className="mt-1 text-xs text-fg-dim">{c.status === "draft" ? "Draft" : "Finished"} · {c.events} recorded {c.events === 1 ? "event" : "events"} · {new Date(c.updatedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</p>
                    </div>
                    {c.verdict === "human_verified" ? <HumanSeal size={36} /> : <span className="shrink-0 text-sm font-semibold text-fg">{c.status === "draft" ? "Continue →" : "View →"}</span>}
                  </Link>
                  <DeleteItemButton endpoint={`/api/creations/${c.id}`} name={c.title} finished={c.status === "finalized"} />
                </li>
              );
            })}
          </ul>
        ) : (
          <div className={panel}><p className="text-sm text-fg-dim">No drawings yet. Start one and it will be saved here as you go.</p></div>
        )}
      </section>
    </main>
  );
}
