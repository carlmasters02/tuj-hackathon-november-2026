import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { Icon, type IconName } from "@/components/Icon";

const FEATURES: { icon: IconName; title: string; tag: string; body: string; href: string }[] = [
  { icon: "sigma", title: "StepCheck", tag: "Algebra to Calculus 3", body: "Write your solution one line at a time, from algebra through integrals and probability. StepCheck finds the first line that stops being equivalent and tells you what kind of mistake it is — never the answer.", href: "/tutor/math" },
  { icon: "code", title: "Code Dojo", tag: "Python · C · Java", body: "Exercises graded against hidden tests on our own sandbox. Compiler errors explained in plain English. Hints unlock slowly. There's no 'show solution' button.", href: "/tutor/code" },
  { icon: "pencil", title: "Written Here", tag: "Authentic editor", body: "Every keystroke goes into a hash-chained log. Finalize to get a signed certificate and a replay anyone can watch. Pasted text shows up — honestly.", href: "/write" },
  { icon: "pilcrow", title: "RedPen", tag: "Writing coach", body: "Flags passive voice, filler, clichés and sentences over 30 words, and coaches research papers, essays and poems on their own terms. It never rewrites a word for you.", href: "/tutor/writing" },
  { icon: "clock", title: "Reliance Tracker", tag: "Chrome extension", body: "Counts only active minutes on AI sites — no URLs, no prompts, no keystrokes. Think First asks for your own attempt before you ask a bot.", href: "/dashboard" },
  { icon: "frame", title: "Portfolio", tag: "Art · writing · music", body: "Draw in the studio or compose in the composer, and the whole process is on record. Work that passes replay and integrity checks earns the creation-record seal. AI crawlers get a 403.", href: "/portfolio" },
];

const CARD = "rounded-3xl border border-line bg-[#fffdf8]/80 shadow-[0_5px_18px_rgba(62,48,22,0.035)]";

export default async function Home() {
  const user = await currentUser();
  const demo = process.env.HM_DEMO_MODE === "true";
  return (
    <div className="space-y-20 sm:space-y-24">
      <section className="mx-auto max-w-[1240px] pt-10 text-center sm:pt-16 lg:pt-20">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#f1c84b] bg-[#fff7d9] px-4 py-2 text-[0.7rem] font-bold text-fg-dim sm:text-xs">
          <span aria-hidden>✓</span> Verified AI-free — zero model calls, checked on every build
        </span>
        {/* the hero headline is the one heading set in the sans face (global h1 rule uses the display serif) */}
        <h1 className="mx-auto mt-7 max-w-[1160px] text-[clamp(2.7rem,7.2vw,6rem)] font-extrabold leading-[0.99] tracking-[-0.06em] text-fg" style={{ fontFamily: "var(--font-sans)" }}>
          Your ideas, your
          <br />
          <span className="relative z-0 whitespace-nowrap after:absolute after:inset-x-[-2%] after:bottom-[0.07em] after:-z-10 after:h-[0.36em] after:bg-sun after:content-['']">imagination.</span>
          <br />
          We just check the work.
        </h1>
        <p className="mx-auto mt-8 max-w-[790px] text-base font-medium leading-[1.65] text-fg-dim sm:text-lg lg:text-xl">
          Humagination is a tutor that cheers you on but never hands you the answer, an editor that proves you wrote it, and a portfolio where only work made by a human earns the seal. Everything runs on plain, honest code — no AI anywhere.
        </p>
        <div className="mt-9 flex flex-col justify-center gap-3.5 sm:flex-row sm:flex-wrap">
          <Link
            href={user || demo ? "/dashboard" : "/signup"}
            className="inline-flex min-h-[3.4rem] items-center justify-center rounded-[17px] border border-fg bg-fg px-8 text-[0.95rem] font-bold text-surface shadow-[0_4px_12px_rgba(42,35,18,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(42,35,18,0.12)] motion-reduce:hover:translate-y-0"
          >
            {user ? "Go to your dashboard" : demo ? "Try the demo" : "Start creating"}
          </Link>
          <Link
            href="/verify"
            className="inline-flex min-h-[3.4rem] items-center justify-center rounded-[17px] border border-line bg-[#fffdf8] px-8 text-[0.95rem] font-bold text-fg shadow-[0_4px_12px_rgba(42,35,18,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(42,35,18,0.09)] motion-reduce:hover:translate-y-0"
          >
            Verify a certificate
          </Link>
        </div>
      </section>

      <section aria-labelledby="features-heading">
        <h2 id="features-heading" className="mb-6 text-[clamp(1.55rem,2.6vw,2.1rem)] font-bold tracking-[-0.03em] text-fg">
          Six ways to keep your mind in the driver&apos;s seat
        </h2>
        <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Link key={f.title} href={f.href} className={`${CARD} group min-h-[190px] p-[26px] transition hover:-translate-y-0.5 hover:border-[#f1c84b] hover:shadow-[0_10px_24px_rgba(62,48,22,0.08)] motion-reduce:hover:translate-y-0`}>
              <div className="mb-4 flex items-center gap-[15px]">
                <span className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-[17px] border border-[#f5d16b] bg-[#fff1bd] text-fg">
                  <Icon name={f.icon} />
                </span>
                <div>
                  <h3 className="text-[1.45rem] font-bold leading-tight tracking-[-0.03em] text-fg">{f.title}</h3>
                  <p className="text-[0.8rem] font-semibold text-fg-faint">{f.tag}</p>
                </div>
              </div>
              <p className="text-[0.95rem] leading-[1.65] text-fg-dim">{f.body}</p>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="promise-heading" className={`${CARD} grid grid-cols-1 gap-6 p-[26px] md:grid-cols-3`}>
        <h2 id="promise-heading" className="text-[clamp(1.4rem,2.2vw,1.8rem)] font-bold tracking-[-0.03em] text-fg">What we promise — and what we don&apos;t</h2>
        <ul className="space-y-2.5 text-[0.95rem] leading-[1.65] text-fg-dim md:col-span-2">
          <li>✓ Certificates prove text was produced in this editor, keystroke by keystroke. They can&apos;t prove you didn&apos;t copy by hand from another screen — the revision and cadence stats are there so readers can judge.</li>
          <li>✓ Portfolio images are screenshot-<em>deterred</em> and <em>traceable</em>, not screenshot-proof. Nothing on the web is.</li>
          <li>✓ Tracker numbers are self-reported by your own browser extension. They&apos;re for motivation, not proof.</li>
        </ul>
      </section>
    </div>
  );
}
