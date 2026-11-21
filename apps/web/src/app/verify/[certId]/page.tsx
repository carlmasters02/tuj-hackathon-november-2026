import Link from "next/link";
import { notFound } from "next/navigation";
import { verifyCertificateSignature, contentHash, type SignedCertificate } from "@hm/shared/certificate";
import { VERDICT_LABEL, type DocStats, type Verdict } from "@hm/shared/provenance/stats";
import { replay, verifyChain, type StoredBatch } from "@hm/shared/provenance/index";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { serverPublicKey } from "@/lib/server/certs";
import { UUID } from "@/lib/http";
import { ReplayPlayer } from "@/components/verify/ReplayPlayer";
import { CertJson } from "@/components/verify/CertJson";
import { currentUser } from "@/lib/auth";
import { PublishCertButton } from "@/components/verify/PublishCertButton";
import { creationStats, verifyCreationChain, type CreationBatch, type CreationStats } from "@hm/shared/creation";
import { ArtReplay } from "@/components/studio/ArtReplay";
import { ScorePlayer } from "@/components/studio/ScorePlayer";

export const metadata = { title: "Certificate", other: { robots: "noai, noimageai" } };

const VERDICT_STYLE: Record<Verdict, string> = {
  human_verified: "border-ok/50 bg-ok-dim text-ok",
  mostly_human: "border-warn/50 bg-warn-dim text-warn",
  unverified: "border-redpen/50 bg-redpen-dim text-redpen",
};

const fmtTime = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m` : `${Math.floor(s / 60)}m ${s % 60}s`);

export default async function CertificatePage({ params }: { params: Promise<{ certId: string }> }) {
  const { certId } = await params;
  if (!UUID.safeParse(certId).success) notFound();
  const { data: row } = await supabaseAdmin().from("certificates").select("id, owner_id, kind, payload, signature, public_key, events_json, verdict").eq("id", certId).maybeSingle();
  if (!row) notFound();

  const pinned = await serverPublicKey();
  const cert: SignedCertificate = { payload: row.payload, signature: row.signature, publicKey: row.public_key };
  const sigOk = row.public_key === pinned && (await verifyCertificateSignature(cert, pinned));
  if (row.kind === "art" || row.kind === "music") return <CreationCertificate row={row} sigOk={sigOk} cert={cert} />;
  const batches = row.events_json as StoredBatch[];
  // Independent re-check on this page load: chain head and replayed content must match the signed values.
  const chain = verifyChain(cert.payload.docId, batches);
  const text = replay(batches.flatMap((b) => b.events));
  const chainOk = chain.ok && chain.head === cert.payload.logHeadHash;
  const contentOk = contentHash(text) === cert.payload.contentHash;
  const s = cert.payload.stats as DocStats;
  const v = cert.payload.verdict;
  const viewer = await currentUser();
  const isOwner = viewer?.id === row.owner_id;
  const { data: published } = await supabaseAdmin().from("gallery_works").select("id").eq("cert_id", certId).maybeSingle();

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="text-xs uppercase tracking-wide text-fg-faint">Humagination certificate</div>
        <h1 className="h-page">{cert.payload.title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className={`rounded-full border px-3 py-1 font-medium ${VERDICT_STYLE[v]}`}>{VERDICT_LABEL[v]}</span>
          <span className="text-fg-dim">by <Link className="link" href={`/u/${cert.payload.author}`}>@{cert.payload.author}</Link></span>
          <span className="text-fg-faint">issued {new Date(cert.payload.issuedAt).toLocaleString()}</span>
        </div>
        {isOwner && v === "human_verified" && <PublishCertButton certId={certId} publishedId={published?.id ?? null} />}
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Check ok={sigOk} label="Signature" detail={sigOk ? "Ed25519 signature matches Humagination's published key" : "Signature does NOT verify"} />
        <Check ok={chainOk} label="Hash chain" detail={chainOk ? `${s.events} events, chain re-computed on this page load` : `Broken: ${chain.ok ? "head mismatch" : chain.reason}`} />
        <Check ok={contentOk} label="Replay" detail={contentOk ? "Replaying the log reproduces the certified text exactly" : "Replay does not reproduce the text"} />
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Typed here" value={`${s.typedPct}%`} hint="share of the final text's characters typed in this editor" />
        <Stat label="External pastes" value={`${s.externalPasteCount}`} hint={`${s.externalPasteChars} characters pasted from outside`} />
        <Stat label="Active writing time" value={fmtTime(s.activeSeconds)} hint={`${s.finalWords} words · ${s.wpm} wpm average`} />
        <Stat label="Revision ratio" value={s.revisionRatio.toFixed(2)} hint={`${s.deletedChars} chars deleted / ${s.insertedChars} inserted`} />
        <Stat label="Peak cadence" value={`${s.maxWpm60s} wpm`} hint="fastest 60-second window (5 chars = 1 word)" />
        <Stat label="Injection bursts" value={`${s.injectionBursts.length}`} hint=">20 chars appearing in <50 ms without a paste" />
        <Stat label="Sessions" value={`${s.sessions}`} hint="separate editing sessions" />
        <Stat label="Server timing" value={s.time.ok ? "consistent" : "inconsistent"} hint={`client ahead ≤ ${Math.round(s.time.maxClientAheadMs / 1000)}s · max batch span ${Math.round(s.time.maxBatchSpanMs / 1000)}s`} />
      </section>

      {s.flags.length > 0 && (
        <section className="rounded-xl border border-warn/40 bg-warn-dim p-4 text-sm">
          <h2 className="mb-2 font-medium text-warn">Flags</h2>
          <ul className="list-disc space-y-1 pl-5">{s.flags.map((f) => <li key={f}>{f}</li>)}</ul>
        </section>
      )}

      <ReplayPlayer batches={batches} />

      <section className="card space-y-2 p-5 text-sm text-fg-dim">
        <h2 className="text-lg font-extrabold text-fg">What this proves</h2>
        <p>It proves the text was produced in the Humagination editor and exactly how — every insertion, deletion and paste, in order, timestamped and checked by the server as it happened.</p>
        <p><strong className="text-fg">It cannot prove the author didn&apos;t copy by hand from another source.</strong> That&apos;s why the revision ratio and typing cadence are shown: transcription tends to have almost no revisions and a very even rhythm. Judge accordingly.</p>
      </section>

      <CertJson cert={cert} />
    </div>
  );
}

function Check({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className={`rounded-xl border p-4 ${ok ? "border-ok/40" : "border-redpen/50 bg-redpen-dim"}`}>
      <div className="flex items-center gap-2 text-sm font-medium"><span className={ok ? "text-ok" : "text-redpen"}>{ok ? "✓" : "✗"}</span>{label}</div>
      <p className="mt-1 text-xs text-fg-dim">{detail}</p>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="card p-4">
      <div className="text-2xl">{value}</div>
      <div className="text-xs uppercase tracking-wide text-fg-faint">{label}</div>
      <div className="mt-1 text-xs text-fg-dim">{hint}</div>
    </div>
  );
}

/** Certificates for drawing-studio art and composer music: same checks, different evidence. */
async function CreationCertificate({ row, sigOk, cert }: { row: { id: string; owner_id: string; kind: "art" | "music" }; sigOk: boolean; cert: SignedCertificate }) {
  const batches = (row as unknown as { events_json: CreationBatch[] }).events_json;
  const chain = verifyCreationChain(cert.payload.docId, batches);
  const chainOk = chain.ok && chain.head === cert.payload.logHeadHash;
  const { contentHash: replayed } = creationStats(row.kind, batches);
  const contentOk = replayed === cert.payload.contentHash;
  const s = cert.payload.stats as unknown as CreationStats;
  const v = cert.payload.verdict;
  const { data: work } = await supabaseAdmin().from("gallery_works").select("id").eq("cert_id", row.id).maybeSingle();
  const art = row.kind === "art";
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="text-sm font-semibold text-fg-faint">{art ? "Drawing studio" : "Composer"} certificate</div>
        <h1 className="h-page">{cert.payload.title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className={`rounded-full border px-3 py-1 font-medium ${VERDICT_STYLE[v]}`}>{VERDICT_LABEL[v]}</span>
          <span className="text-fg-dim">by <Link className="link" href={`/u/${cert.payload.author}`}>@{cert.payload.author}</Link></span>
          <span className="text-fg-faint">issued {new Date(cert.payload.issuedAt).toLocaleString()}</span>
          {work && <Link className="link" href={`/portfolio/work/${work.id}`}>View in the portfolio</Link>}
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Check ok={sigOk} label="Signature" detail={sigOk ? "Ed25519 signature matches Humagination's published key" : "Signature does NOT verify"} />
        <Check ok={chainOk} label="Hash chain" detail={chainOk ? `${s.events} events, chain re-computed on this page load` : `Broken: ${chain.ok ? "head mismatch" : chain.reason}`} />
        <Check ok={contentOk} label="Replay" detail={contentOk ? `Replaying the log reproduces the certified ${art ? "drawing" : "score"} exactly` : "Replay does not match the certificate"} />
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {art ? (
          <>
            <Stat label="Strokes drawn" value={`${s.strokes ?? 0}`} hint={`${s.finalStrokes ?? 0} in the final drawing, ${s.undos ?? 0} undone`} />
            <Stat label="Too-fast strokes" value={`${s.scriptedStrokes ?? 0}`} hint="long strokes laid down in under 40 ms" />
          </>
        ) : (
          <>
            <Stat label="Note edits" value={`${s.noteEdits ?? 0}`} hint="every note placed or removed" />
            <Stat label="Final notes" value={`${s.finalNotes ?? 0}`} hint="notes in the finished score" />
          </>
        )}
        <Stat label="Active time" value={fmtTime(s.activeSeconds)} hint={`${s.sessions} ${s.sessions === 1 ? "session" : "sessions"}`} />
        <Stat label="Server timing" value={s.time.ok ? "consistent" : "inconsistent"} hint={`client ahead ≤ ${Math.round(s.time.maxClientAheadMs / 1000)}s · max batch span ${Math.round(s.time.maxBatchSpanMs / 1000)}s`} />
      </section>

      {s.flags.length > 0 && (
        <section className="rounded-xl border border-warn/40 bg-warn-dim p-4 text-sm">
          <h2 className="mb-2 font-medium text-warn">Flags</h2>
          <ul className="list-disc space-y-1 pl-5">{s.flags.map((f) => <li key={f}>{f}</li>)}</ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold tracking-tight">{art ? "Watch it being drawn" : "Hear it, and watch it being written"}</h2>
        {art ? <ArtReplay batches={batches} /> : <ScorePlayer batches={batches} />}
      </section>

      <section className="card space-y-2 p-5 text-sm text-fg-dim">
        <h2 className="text-lg font-extrabold text-fg">What this proves</h2>
        {art ? (
          <p>The published image was rendered by the server from these strokes, so it is exactly what was drawn here, in this order, at this pace. <strong className="text-fg">It can&apos;t prove the artist wasn&apos;t tracing something on another screen.</strong> The replay is there so you can judge how the piece came together.</p>
        ) : (
          <p>The score is rebuilt from every note placed or removed, timestamped by the server as it happened. <strong className="text-fg">It can&apos;t prove the melody wasn&apos;t copied from somewhere by ear.</strong> The replay shows how it was worked out.</p>
        )}
      </section>

      <CertJson cert={cert} />
    </div>
  );
}
