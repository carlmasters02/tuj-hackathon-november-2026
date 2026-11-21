import Link from "next/link";
import { currentUser } from "@/lib/auth";

const FEATURES = [
  { title: "StepCheck", tag: "Math tutor", body: "Write your solution one line at a time. StepCheck finds the first line that stops being equivalent and tells you what kind of mistake it is — never the answer.", href: "/tutor/math" },
  { title: "Code Dojo", tag: "Python · C · Java", body: "Exercises graded against hidden tests on our own sandbox. Compiler errors explained in plain English. Hints unlock slowly. There is no 'show solution' button.", href: "/tutor/code" },
  { title: "Written Here", tag: "Authentic editor", body: "Every keystroke goes into a hash-chained log. Finalize to get a signed certificate and a replay anyone can watch. Pasted text shows up — honestly.", href: "/write" },
  { title: "RedPen", tag: "Writing coach", body: "Flags passive voice, filler, clichés and 40-word sentences, and explains why. It never rewrites a word for you.", href: "/write" },
  { title: "Reliance Tracker", tag: "Chrome extension", body: "Counts only active minutes on AI sites — no URLs, no prompts, no keystrokes. Think First mode asks for your own attempt before you ask a bot.", href: "/dashboard" },
  { title: "Protected Gallery", tag: "Art · writing · music", body: "AI crawlers get a 403. Originals are encrypted and never served. Every preview carries the viewer's name, so leaks are traceable.", href: "/gallery" },
];

export default async function Home() {
  const user = await currentUser();
  return (
    <div className="space-y-20">
      <section className="grid gap-10 pt-6 md:grid-cols-[1.3fr_1fr] md:items-end">
        <div className="space-y-6">
          <span className="chip">✓ Verified AI-free — zero model calls, checked in CI</span>
          <h1 className="h-display">
            Do the thinking <span className="text-redpen">yourself.</span>
            <br />
            We&apos;ll check your work.
          </h1>
          <p className="max-w-xl text-lg text-paper-dim">
            Humagination is a tutor that refuses to give answers, an editor that proves you wrote it, and a gallery that keeps
            your work out of training sets. Every feature is plain, deterministic code: parsers, solvers, hashes and signatures.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href={user ? "/dashboard" : "/signup"} className="btn btn-primary px-5 py-2.5">
              {user ? "Go to your dashboard" : "Start creating"}
            </Link>
            <Link href="/verify" className="btn px-5 py-2.5">Verify a certificate</Link>
          </div>
        </div>
        <div className="card p-5 font-mono text-sm">
          <div className="mb-3 text-xs uppercase tracking-wide text-paper-faint">StepCheck · 3(x − 2) = 2x + 4</div>
          <ol className="space-y-1.5">
            <li className="flex gap-3"><span className="w-4 text-paper-faint">1</span><span className="text-ok">3x − 6 = 2x + 4</span></li>
            <li className="flex gap-3 rounded bg-redpen-dim px-1 -mx-1"><span className="w-4 text-paper-faint">2</span><span className="text-redpen">x = 4 − 6</span></li>
            <li className="flex gap-3 opacity-40"><span className="w-4 text-paper-faint">3</span><span>x = −2</span></li>
          </ol>
          <p className="mt-4 border-t border-line pt-3 font-sans text-sm text-paper-dim">
            <span className="text-redpen">Line 2 is not equivalent to line 1.</span> This looks like a sign error: a term moved to the other side of the = sign but kept its sign.
          </p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <Link key={f.title} href={f.href} className="card group p-5 transition hover:border-paper-faint">
            <div className="text-xs uppercase tracking-wide text-paper-faint">{f.tag}</div>
            <h2 className="mt-1 font-serif text-xl group-hover:text-white">{f.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-paper-dim">{f.body}</p>
          </Link>
        ))}
      </section>

      <section className="card grid gap-6 p-6 md:grid-cols-3">
        <div>
          <h2 className="font-serif text-2xl">What we promise — and what we don&apos;t</h2>
        </div>
        <ul className="space-y-2 text-sm text-paper-dim md:col-span-2">
          <li>✓ Certificates prove text was produced in this editor, keystroke by keystroke. They can&apos;t prove you didn&apos;t copy by hand from another screen — the revision and cadence stats are there so readers can judge.</li>
          <li>✓ Gallery images are screenshot-<em>deterred</em> and <em>traceable</em>, not screenshot-proof. Nothing on the web is.</li>
          <li>✓ Tracker numbers are self-reported by your own browser extension. They&apos;re for motivation, not proof.</li>
        </ul>
      </section>
    </div>
  );
}
