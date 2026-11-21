/**
 * Seeds a Humagination project with demo data:
 *   - 2 demo users (confirmed): alice / bob
 *   - 1 certified document (from a synthetic, clearly-labelled typing log)
 *   - 2 procedurally generated art pieces run through the real upload pipeline
 * Problems (math + code) are JSON in packages/shared and need no seeding.
 *
 * Run: pnpm seed   (from the repo root; reads apps/web/.env.local)
 */
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { chainHead, computeStats, genesisHash, verdictFor, type DocEvent } from "@hm/shared/provenance/index";
import { contentHash, signCertificate } from "@hm/shared/certificate";
import { supabaseAdmin } from "../src/lib/supabase/admin";
import { keyBytes } from "../src/lib/env";
import { encryptBytes, encryptString, sha256 } from "../src/lib/crypto";
import { enc } from "../src/lib/server/docs";
import { dHashOf, makePreview, normalizeImage, watermarkedMaster } from "../src/lib/server/images";
import { upload } from "../src/lib/server/storage";

const sb = supabaseAdmin();
const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? "humagination demo password";

async function ensureUser(email: string, username: string): Promise<string> {
  const { data: existing } = await sb.from("profiles").select("id").eq("username", username).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await sb.auth.admin.createUser({ email, password: DEMO_PASSWORD, email_confirm: true, user_metadata: { username, display_name: username[0].toUpperCase() + username.slice(1) } });
  if (error) throw error;
  return data.user.id;
}

/** A human-like synthetic log: ~160–260 ms per key with jitter, pauses at sentence ends, some typos fixed. */
function syntheticLog(text: string): DocEvent[] {
  const ev: DocEvent[] = [];
  let t = 400;
  let pos = 0;
  let seq = 0;
  let r = 7;
  const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff), r / 0x7fffffff);
  for (const ch of text) {
    if (rnd() < 0.04 && /[a-z]/.test(ch)) {
      // typo then backspace
      ev.push({ seq: seq++, t, type: "insert", from: pos, to: pos, text: "x", len: 1 });
      t += 180 + Math.round(rnd() * 120);
      ev.push({ seq: seq++, t, type: "delete", from: pos, to: pos + 1, len: 0 });
      t += 220;
    }
    ev.push({ seq: seq++, t, type: "insert", from: pos, to: pos, text: ch, len: 1 });
    pos++;
    t += 160 + Math.round(rnd() * 100) + (/[.!?]/.test(ch) ? 1500 + Math.round(rnd() * 2500) : 0);
  }
  return ev;
}

async function seedDocument(ownerId: string, username: string) {
  const title = "On learning slowly (seeded demo)";
  const { data: has } = await sb.from("certificates").select("id").eq("owner_id", ownerId).eq("title", title).maybeSingle();
  if (has) return has.id;
  const text =
    "I used to think that being fast meant being good. I would ask for the answer, copy it, and move on. " +
    "This term I tried something different: I wrote every solution myself, even when it took an hour. " +
    "It was slower. It was also the first time I actually remembered what I learned a week later.";
  const docId = randomUUID();
  const sessionId = randomUUID();
  const events = syntheticLog(text);
  // batches every ~2 s with server receipt times that match the timeline
  const start = Date.now() - 3600_000;
  const batches: { seq_start: number; seq_end: number; events_json: DocEvent[]; head_hash: string; received_at: string; session_id: string }[] = [];
  let prev = genesisHash(docId, sessionId);
  let cur: DocEvent[] = [];
  let windowEnd = 2000;
  const flush = () => {
    if (!cur.length) return;
    const head = chainHead(prev, cur);
    batches.push({ session_id: sessionId, seq_start: cur[0].seq, seq_end: cur[cur.length - 1].seq, events_json: cur, head_hash: head, received_at: new Date(start + cur[cur.length - 1].t + 400).toISOString() });
    prev = head;
    cur = [];
  };
  for (const e of events) {
    if (e.t >= windowEnd) {
      flush();
      windowEnd = e.t + 2000;
    }
    cur.push(e);
  }
  flush();
  const content = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] };
  await sb.from("documents").insert({ id: docId, owner_id: ownerId, title_enc: enc(docId, "title", title), content_enc: enc(docId, "content", JSON.stringify(content)), text_enc: enc(docId, "text", text), first_session_id: sessionId, head_hash: prev, last_seq: events.length - 1, status: "finalized" });
  await sb.from("doc_event_batches").insert(batches.map((b) => ({ doc_id: docId, ...b })));
  const stored = batches.map((b) => ({ sessionId, seqStart: b.seq_start, seqEnd: b.seq_end, events: b.events_json, headHash: b.head_hash, receivedAt: b.received_at }));
  const { stats, text: replayed } = computeStats(stored);
  const certId = randomUUID();
  const payload = { v: 1 as const, certId, docId, author: username, title, contentHash: contentHash(replayed), logHeadHash: prev, stats, verdict: verdictFor(stats, replayed === text), issuedAt: new Date().toISOString() };
  const signed = await signCertificate(payload, keyBytes("HM_SIGNING_KEY"));
  await sb.from("certificates").insert({ id: certId, doc_id: docId, owner_id: ownerId, title, verdict: payload.verdict, payload, signature: signed.signature, public_key: signed.publicKey, events_json: stored });
  if (payload.verdict === "human_verified") await sb.from("gallery_works").insert({ owner_id: ownerId, kind: "writing", title, cert_id: certId, published: true });
  return certId;
}

function artSvg(seed: number): Buffer {
  let shapes = "";
  let r = seed;
  const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff), r / 0x7fffffff);
  const hues = [10, 35, 200, 260, 140].map((h) => (h + seed * 37) % 360);
  for (let i = 0; i < 28; i++) {
    const x = Math.round(rnd() * 900), y = Math.round(rnd() * 700), s = 40 + Math.round(rnd() * 260);
    const h = hues[i % hues.length];
    shapes += i % 3 === 0 ? `<circle cx="${x}" cy="${y}" r="${s / 2}" fill="hsl(${h},60%,55%)" fill-opacity="0.55"/>` : `<rect x="${x}" y="${y}" width="${s}" height="${s * 0.6}" transform="rotate(${Math.round(rnd() * 90)} ${x} ${y})" fill="hsl(${h},55%,45%)" fill-opacity="0.5"/>`;
  }
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="760"><rect width="100%" height="100%" fill="hsl(${hues[0]},25%,12%)"/>${shapes}</svg>`);
}

async function seedArt(ownerId: string, username: string, title: string, seed: number) {
  const { data: has } = await sb.from("gallery_works").select("id").eq("owner_id", ownerId).eq("title", title).maybeSingle();
  if (has) return has.id;
  const png = await sharp(artSvg(seed)).png().toBuffer();
  const workId = randomUUID();
  const norm = await normalizeImage(png);
  const dhash = await dHashOf(norm.raw, norm.width, norm.height);
  const master = await watermarkedMaster(norm.raw, norm.width, norm.height, { workId, ownerId, timestamp: Math.floor(Date.now() / 1000) }, keyBytes("HM_WATERMARK_KEY"));
  const originalPath = `${ownerId}/${workId}.bin`;
  await upload("art-originals", originalPath, encryptBytes(master, `work:${workId}:original`));
  const preview = await makePreview(norm.raw, norm.width, norm.height, username);
  const previewPath = `${ownerId}/${workId}.webp`;
  await upload("art-previews", previewPath, preview.buf, "image/webp");
  await sb.from("gallery_works").insert({ id: workId, owner_id: ownerId, kind: "art", title, description: "Procedurally generated by the seed script for the demo.", sha256: sha256(png), dhash, storage_key_enc: encryptString(originalPath, `work:${workId}:key`), preview_key: previewPath, mime: "image/png", width: preview.width, height: preview.height, published: true });
  return workId;
}

(async () => {
  const alice = await ensureUser("alice@example.com", "alice");
  const bob = await ensureUser("bob@example.com", "bob");
  await sb.from("profiles").update({ leaderboard_opt_in: true }).in("id", [alice, bob]);
  const cert = await seedDocument(alice, "alice");
  await seedArt(alice, "alice", "Tidepool", 3);
  await seedArt(bob, "bob", "Night market", 11);
  console.log(`Seeded. Users: alice@example.com / bob@example.com (password: "${DEMO_PASSWORD}"). Certificate: /verify/${cert}`);
})().catch((e) => {
  console.error("seed failed:", e.message ?? e);
  process.exit(1);
});
