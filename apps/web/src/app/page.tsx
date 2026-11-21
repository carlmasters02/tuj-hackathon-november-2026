import Link from "next/link";
import Image from "next/image";
import { currentUser } from "@/lib/auth";
import bulb from "@/assets/bulb.png";
import { Icon, type IconName } from "@/components/Icon";

const FEATURES: { icon: IconName; title: string; tag: string; body: string; href: string }[] = [
  { icon: "sigma", title: "StepCheck", tag: "Math tutor", body: "Write your solution one line at a time. StepCheck finds the first line that stops being equivalent and tells you what kind of mistake it is — never the answer.", href: "/tutor/math" },
  { icon: "code", title: "Code Dojo", tag: "Python · C · Java", body: "Exercises graded against hidden tests on our own sandbox. Compiler errors explained in plain English. Hints unlock slowly. There's no 'show solution' button.", href: "/tutor/code" },
  { icon: "pencil", title: "Written Here", tag: "Authentic editor", body: "Every keystroke goes into a hash-chained log. Finalize to get a signed certificate and a replay anyone can watch. Pasted text shows up — honestly.", href: "/write" },
  { icon: "pilcrow", title: "RedPen", tag: "Writing coach", body: "Flags passive voice, filler, clichés and 40-word sentences, and explains why. It never rewrites a word for you.", href: "/write" },
  { icon: "clock", title: "Reliance Tracker", tag: "Chrome extension", body: "Counts only active minutes on AI sites — no URLs, no prompts, no keystrokes. Think First asks for your own attempt before you ask a bot.", href: "/dashboard" },
  { icon: "frame", title: "Protected Gallery", tag: "Art · writing · music", body: "AI crawlers get a 403. Originals are encrypted and never served. Every preview carries the viewer's name, so leaks are traceable.", href: "/gallery" },
];

export default async function Home() {
  const user = await currentUser();
  return (
    <div className="space-y-20">
      <section className="grid items-center gap-10 pt-4 md:grid-cols-[1.25fr_1fr]">
        <div className="space-y-6">
          <span className="chip chip-sun">✓ Verified AI-free — zero model calls, checked on every build</span>
          <h1 className="h-display">
            Your ideas, your <span className="hl">imagination</span>.
            <br />
            We just check the work.
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-fg-dim">
            Humagination is a tutor that cheers you on but never hands you the answer, an editor that proves you wrote it, and a
            gallery that keeps your art out of AI training sets. Everything runs on plain, honest code — no AI anywhere.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href={user || process.env.HM_DEMO_MODE === "true" ? "/dashboard" : "/signup"} className="btn btn-primary px-6 py-3 text-base">
              {user ? "Go to your dashboard" : process.env.HM_DEMO_MODE === "true" ? "Try the demo" : "Start creating"}
            </Link>
            <Link href="/verify" className="btn px-6 py-3 text-base">Verify a certificate</Link>
          </div>
        </div>

        <div className="relative">
          <Image src={bulb} alt="" aria-hidden priority className="pointer-events-none absolute -top-14 -right-2 hidden w-28 rotate-12 drop-shadow-sm md:block" />
          <div className="card p-5 font-mono text-sm">
            <div className="mb-3 font-sans text-xs font-bold tracking-wide text-fg-faint"><span className="uppercase">StepCheck</span> · 3(x − 2) = 2x + 4</div>
            <ol className="space-y-1.5">
              <li className="flex gap-3"><span className="w-4 text-fg-faint">1</span><span className="text-ok">3x − 6 = 2x + 4 ✓</span></li>
              <li className="-mx-1 flex gap-3 rounded-lg bg-redpen-dim px-1"><span className="w-4 text-fg-faint">2</span><span className="text-redpen">x = 4 − 6</span></li>
              <li className="flex gap-3 opacity-40"><span className="w-4 text-fg-faint">3</span><span>x = −2</span></li>
            </ol>
            <p className="mt-4 rounded-xl bg-sun-soft p-3 font-sans text-sm text-fg">
              <strong>Line 2 isn&apos;t equivalent to line 1.</strong> Looks like a sign error: a term moved across the = sign but kept its sign. You&apos;ve got this!
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="text-2xl font-extrabold">Six ways to keep your mind in the driver&apos;s seat</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Link key={f.title} href={f.href} className="card card-hover group p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-sun-soft text-fg ring-1 ring-sun/60"><Icon name={f.icon} /></span>
                <div>
                  <h3 className="text-lg font-extrabold">{f.title}</h3>
                  <div className="text-xs font-semibold text-fg-faint">{f.tag}</div>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-fg-dim">{f.body}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="card grid gap-6 bg-gradient-to-br from-surface to-sun-soft/60 p-6 md:grid-cols-3">
        <div>
          <h2 className="text-2xl font-extrabold">What we promise — and what we don&apos;t</h2>
        </div>
        <ul className="space-y-2 text-sm leading-relaxed text-fg-dim md:col-span-2">
          <li>✓ Certificates prove text was produced in this editor, keystroke by keystroke. They can&apos;t prove you didn&apos;t copy by hand from another screen — the revision and cadence stats are there so readers can judge.</li>
          <li>✓ Gallery images are screenshot-<em>deterred</em> and <em>traceable</em>, not screenshot-proof. Nothing on the web is.</li>
          <li>✓ Tracker numbers are self-reported by your own browser extension. They&apos;re for motivation, not proof.</li>
        </ul>
      </section>
    </div>
  );
}
