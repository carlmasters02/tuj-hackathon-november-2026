import Link from "next/link";
import type { CreationSummary } from "@/lib/server/creations";
import { HumanSeal } from "@/components/HumanSeal";
import { DeleteItemButton } from "@/components/DeleteItemButton";

/** The viewer's own drafts and finished pieces, as index rows. */
export function CreationList({ items, base, empty }: { items: CreationSummary[]; base: string; empty: string }) {
  if (!items.length) return <p className="border-t border-line py-10 text-fg-dim">{empty}</p>;
  return (
    <ul>
      {items.map((c) => {
        const href = c.status === "draft" ? `${base}/${c.id}` : c.workId ? `/portfolio/work/${c.workId}` : `${base}/${c.id}`;
        return (
          <li key={c.id} className="flex items-center gap-1">
            <Link href={href} className="hm-index-row min-w-0 flex-1">
              <span className="min-w-0">
                <span className="block truncate text-xl font-bold tracking-tight">{c.title}</span>
                <span className="text-sm text-fg-dim">
                  {c.status === "draft" ? "Draft" : "Finished"}, {c.events} recorded {c.events === 1 ? "event" : "events"}, {new Date(c.updatedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                </span>
              </span>
              <span className="flex items-center gap-2">
                {c.verdict === "human_verified" ? <HumanSeal size={40} /> : c.status === "finalized" ? <span className="chip">Record not verified</span> : <span className="chip chip-sun">Continue</span>}
              </span>
            </Link>
            <DeleteItemButton endpoint={`/api/creations/${c.id}`} name={c.title} finished={c.status === "finalized"} />
          </li>
        );
      })}
    </ul>
  );
}
