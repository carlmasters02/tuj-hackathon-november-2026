# Handoff: continuing Humagination

You are picking up an in-progress project from another coding agent. This file is everything you need: what the app is, the owner's standing rules, exactly where the work stopped, and what to build next with the decisions already made. Read it fully before changing anything. `README.md` (features, security model) and `DECISIONS.md` (why things are the way they are) have the long-form detail.

> **Writer completion update (local, 2026-11-21):** `main` was merged into `feature/writer-v2` before this continuation. All Writer items below are now implemented: formatting-only saves without fake events, ordered metadata saves, explicit-break print/screen pagination, multi-page references, sanitized/frozen `doc_json` finalization, rich work-page publishing with legacy fallback, DOCX/archive coverage, settings/history/rich-publication live E2E coverage, and docs. Browser QA passed at 1440px and 390px, plus real six-page A4 PDF and LibreOffice DOCX checks. The full local E2E journey passed 72/72, including stale-formatting conflict rejection and the Words/Writing distinction; lint/typecheck, 232 unit/integration tests and the final production build pass; production smoke checks passed. Only the requested git commit/merge/push and final live-site verification remain. The rest of this file is the original handoff, preserved for design context. Start Phase 2 (Art) only after release verification; do not repeat the completed Writer work.

---

## 1. Where things stand right now

| | Commit | State |
|---|---|---|
| `main` (pushed, live) | `5900239` | Live at **https://humagination.vercel.app** (Vercel auto-deploys `main`). Lint, 210 tests and a production build pass. Includes teammates' latest merges (Rishika's Math and Code hub progress, Bristy's Art page). |
| `feature/writer-v2` (**local only, not pushed**) | the commit that adds this file | The Word-style writer rebuild, part done. Lint, typecheck, 223 tests and a production build pass. **Not yet tested in a browser.** |

Run `git log --oneline main..feature/writer-v2` to see the branch's commits. Push the branch (`git push -u origin feature/writer-v2`) if you're working from another machine. **Don't merge it into `main` until the browser checks in §5 pass.**

There is **no stash** and nothing uncommitted.

**First step:** `main` has moved on since this branch was created (teammate merges). Run `git merge main` on `feature/writer-v2` before continuing. It should merge cleanly, because the branch only touches the editor, the writer page, `Nav.tsx`, `layout.tsx`, `globals.css` (an appended block) and the docs API.

---

## 2. The project in one minute

Humagination is a hackathon app with an anti-AI theme. It helps people learn and create with their own minds, and it uses **zero AI at runtime**: every check is deterministic code. Three tabs:

- **Dashboard:** the share of your thinking that was your own this week (your minutes vs time on AI sites, from a Chrome extension), Human Points and levels, streak, progress, "pick up where you left off".
- **Tutor:** Math (StepCheck: algebra to Calc 3 plus prob/stats, checked line by line on the server, never gives answers), Code (Code Dojo: Python, C and Java with hidden tests), Writing (an editor whose keystrokes are hash-chained and certified, the RedPen coach, and genre coaches for research papers, argumentative essays and poetry).
- **Portfolio:** Art, Words and Music with likes and comments. **Only work made inside the app with a record that passes the checks gets the "Human-made" seal.** Uploads are allowed but never sealed.

Stack: pnpm monorepo. `apps/web` is Next.js 15 (App Router), React 19, Tailwind v4 and TipTap 3.35. `apps/extension` is a Chrome MV3 extension. `packages/shared` holds pure, unit-tested logic and is imported as `@hm/shared/<path>`. The backend is Supabase.

### Infrastructure (IDs only; never print secrets)
- **Supabase** project ref `arueusdzjksqoeholijx` (Singapore). Migrations live in `supabase/migrations/` and were applied with the Supabase MCP `apply_migration` tool. **All 10, including `…000010_writer_v2.sql`, are already applied to the live database.** Migration 10 only adds columns, so it's harmless for `main`.
- **Vercel** project `prj_I9oJp8vwmE3K0sYeJJUkpzyVs7kG`, team `team_YGsQMSqrdt0YGElDMoSPvQAV`, root `apps/web`, Node 22, region `sin1`.
- **Env var names:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `HM_MASTER_KEY`, `HM_SIGNING_KEY`, `HM_MEDIA_HMAC_KEY`, `HM_WATERMARK_KEY`, `HM_EXT_TOKEN_PEPPER`, `HM_DEMO_MODE` (currently `true`), `HM_DETAILED_AUTH_ERRORS` (currently `true`), `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH` (`false`), `CODE_RUNNER`, `PISTON_URL`. Secrets were entered in Vercel by the owner. Locally they're in `apps/web/.env.local`. **Never read or print that file.**

### Commands
```
pnpm dev            # local app (apps/web), uses .env.local
pnpm lint           # no-AI check + service-role check + eslint + typecheck (all packages)
pnpm test           # vitest, all unit tests
pnpm --filter web build
pnpm e2e:live <url> # full user journey against a deployed site (signs up a throwaway user, deletes it after)
pnpm test:authz     # live RLS isolation tests
```
Stop the dev server before `pnpm build`, or the build can be killed for lack of memory (exit 137). Find the dev server's PID and kill that PID. Don't use `pkill -f <pattern>`: it can match and kill your own shell.

---

## 3. Owner's standing rules (follow these exactly)

1. **Quality first.** Do work in manageable phases, **commit between major parts**, and **check thoroughly before saying something is done**: lint, tests, build, *and* a real browser check (screenshots at desktop 1440px and phone 390px).
2. **Security and RLS are serious.** RLS on every table, least-privilege grants, and tamper-sensitive writes only through route handlers using the service role (never from the client). Every API route uses `api()`, `assertSameOrigin()`, `requireUser()`, `rateLimit()` and zod validation (see `apps/web/src/lib/http.ts`).
3. **Zero AI at runtime.** `scripts/no-ai-check.mjs` fails the build if an AI SDK, model package or AI API host appears. Don't add AI libraries, and don't add "AI detectors" (they're unreliable and break the app's promise).
4. **The shared repo must stay clean.** No stray files at the root, no secrets, no `.env*`, no `.claude/`, no prompt files.
5. **Dependencies:** pin exact versions, choose releases at least two weeks old, and check the license. Recent example: `docx@9.15.3` and `lucide-react@1.70.0` were pinned instead of brand-new releases.
6. **Teammates:** when asked to merge their work, review it first. Merge what's safe and good; reject anything unsafe or redundant, and give the owner a kind, specific, copy-pasteable message for the author. Don't delete teammates' branches without asking (`his-feature-name` is stale but kept).
7. **Push to `main` only when the owner asks**, or when a finished, verified phase is ready.
8. **UI tone:** parchment and navy, light and happy. Sentence-case buttons. Copy should be plain and specific. Design tokens are in `apps/web/src/app/globals.css` (`canvas`, `surface`, `muted`, `line`, `fg`, `fg-dim`, `fg-faint`, `sun`, `sun-soft`, `flame`, `redpen`, `ok`, `warn`). Fonts: Bricolage Grotesque for the UI, a book serif for prose. The "Human-made" seal (`components/HumanSeal.tsx`) appears **only** on authentic work.
9. Every responsive grid needs a base `grid-cols-1` (`minmax(0,1fr)`), or wide content stretches it on phones.

---

## 4. The big task you're continuing

The owner said the creative tools were "toys": the art pad is far from what real artists use (layered painting, pixel art), the writer needs Word/Google Docs-level tooling, and the music tool needs real depth. They chose:

- **Build order: Writing → Art → Music.** Each tool is its own phase, committed in parts and pushed when verified.
- **Writer:** **Word-style pages** (page layout, margins, page numbers, MLA/APA templates, tables, footnotes, citations, comments, find & replace, DOCX/PDF export).
- **Art made outside the app** (Procreate, Krita, Photoshop, paper): a separate **"Process shown" badge** earned by uploading a layered source file or 3 or more work-in-progress stages that plain image maths confirms build toward the final piece. The full Human-made seal stays reserved for in-app work.
- **Music:** multi-track piano roll **and microphone recording** (both).

### The non-negotiable design rule behind all three
Authenticity comes from a **hash-chained event log recorded while the work is made, timestamped by the server**, replayed and checked on the server, then signed (Ed25519) into a certificate. Anything that isn't the user's own work must never be able to masquerade as it. Concretely:
- Events go up in ~2 s batches. The server recomputes the chain and rejects gaps, forks and tampering.
- Finalising replays the whole log, computes stats, decides a verdict (`human_verified`, `mostly_human` or `unverified`) and signs.
- The published artifact is **derived from the log on the server** (e.g. studio art is rendered from strokes), never uploaded separately.
- Existing references: writing is in `packages/shared/src/provenance/*` and `apps/web/src/app/api/docs/[id]/{events,finalize}`. Art and music are in `packages/shared/src/creation.ts`, `apps/web/src/app/api/creations/**` and `apps/web/src/components/studio/*`.

---

## 5. Phase 1: Writer (in progress on `feature/writer-v2`)

### Done (on the branch)
- **Schema** (`apps/web/src/lib/editorExtensions.ts`, shared by browser and server): StarterKit with safe links (http, https, mailto only), text style (font, size, colour), highlight, alignment, sub/superscript, tables, checklists, plus custom nodes: `pageBreak`, `citation` (inline atom), `footnoteRef`, a `footnotes` section that must be the doc's last block, `footnote`, and a `comment` mark. Citations, footnote markers, page breaks, formatting and comments add **nothing** to the recorded plain-text projection; only typed text does. Tested in `apps/web/test/editorSchema.test.ts`.
- **Provenance:** a new event source `src: "app"` for edits the app makes on the writer's behalf (Find & Replace). They count as **not typed**, are capped at 200 chars per event (`APP_EDIT_MAX_CHARS`), never count as typing bursts, can't label a paste, and are flagged if they exceed 5% of the final text. See `packages/shared/src/provenance/{types,stats}.ts`, with tests.
- **Recorder fix** (`components/editor/recorder.ts`): it now diffs against the **last recorded text**, not `tr.before`, so edits appended by plugins (tables, lists) can't make the log drift from the content. `record(tr, editor.state.doc)` returns the new text.
- **Document settings** (`packages/shared/src/docMeta.ts`): page size, margins, template (none, MLA, APA), font, size, line spacing, page numbers, heading fields, citation style, sources (≤300), comments (≤500), word goal. Stored encrypted in `documents.meta_enc` via `PATCH /api/docs/:id { meta }` (zod-validated, refused once finalized). Zod 4 note: nested object defaults need `.prefault({})`, not `.default({})`.
- **Citations** (`packages/shared/src/citations.ts`): APA 7 and MLA 9 in-text citations and reference lists, sorting, with tests.
- **UI** (all in `apps/web/src/components/editor/`):
  - `Editor.tsx` is the shell.
  - `Ribbon.tsx` is the toolbar: styles, font, size, B/I/U/S, sub/sup, colour, highlight, clear formatting, alignment, lists and indent, quote, link, table grid picker plus table actions, footnote, citation picker, page break, comment, find.
  - `Paper.tsx` draws the pages: sheets, page numbers, MLA heading, APA title page, References/Works Cited page, zoom, and print CSS for page size, margins and page numbers.
  - `clientExtensions.ts` holds the pagination plugin (measures blocks and inserts spacer decorations), Find & Replace, the live citation node view and shortcuts: Ctrl+Enter page break, Ctrl+F/H find, Ctrl+Alt+F footnote.
  - `Panels.tsx` holds the side panels: Page setup, Sources, Comments, Outline, History (slider replaying the owner's log via `GET /api/docs/:id/history`).
  - `FindBar.tsx` is the Find & Replace bar.
  - `exportDocx.ts` exports to Word, loaded on demand, with real footnotes, numbering, tables, header/footer page numbers and references.
  - `ui.tsx` holds toolbar primitives.
- The writer page (`app/write/[id]/page.tsx`) gets a wider canvas and passes `meta`. Nav, footer and the demo banner are hidden in print. Paper/doc CSS is at the end of `globals.css`.

### Remaining, in order
1. **Browser QA (most important).** Run `pnpm dev`, open a doc (`/tutor/writing/research-paper` → "Start a new research paper") and check every ribbon control, page flow across sheets, page breaks, a table, a footnote, citations with APA↔MLA switching and the References page, comments, find & replace, outline, history slider, zoom, the MLA and APA templates, print preview (Ctrl+P), and the DOCX download (open it in Word or LibreOffice). Watch the console for errors. **Critically**, after editing a while, confirm the save status never shows "Out of sync" or "Stopped": that would mean the text projection and the recorder disagree. Fix what you find. Pagination is the riskiest part; measurement lives in `Pagination.measure`.
2. **Finalize with formatting.** In `app/api/docs/[id]/finalize/route.ts`, also store `certificates.doc_json` (column exists): the content JSON **with comment marks stripped**, citation `label` attributes frozen from the sources and style, plus `{ setup, citationStyle, sources }` without comments. Validate it against the schema, and require its plain-text projection to equal the replayed text.
3. **Publish with formatting.** The portfolio work page (`app/portfolio/work/[id]/page.tsx`) and `components/portfolio/Feed.tsx` currently show writing as replayed plain text. Render `doc_json` with `generateHTML` (`@tiptap/html`, already installed; use the server-safe entry if needed) inside the existing per-viewer watermark layer, then the references list. Keep plain text as the fallback for old certificates.
4. Add a DOCX smoke test (generate one, unzip, check `word/document.xml` contains the text). Extend `apps/web/test/e2e-live.ts` for settings PATCH and history. Run `pnpm e2e:live http://localhost:3000` (demo mode is handled by the test).
5. Update README (Writer section) and DECISIONS, run the full checks, merge into `main`, push, then check the live site.

Known limitations to note honestly in the README: footnotes render as endnotes ("Notes") on screen (DOCX has true footnotes); a single block taller than a page runs past the sheet edge; on-screen pagination is approximate, while print and DOCX paginate exactly.

---

## 6. Phase 2: Art (not started)

Current studio: `components/studio/Studio.tsx` (pen, marker, eraser, palette, sizes, undo, clear) on a 1200×900 canvas. Events are defined in `packages/shared/src/creation.ts`, and the server renders an SVG to PNG with `sharp` in `app/api/creations/[id]/finalize`. Sealing needs ≥12 strokes and ≥45 s of active time with no flags.

Build:
- **A real painting app:** layers (add, reorder, hide, opacity, blend modes), pen-pressure brushes (Pointer Events `pressure`, `tiltX/Y`) with size, opacity, flow and hardness, brush types (pencil, ink, airbrush/soft, marker, eraser), an HSV picker and eyedropper, fill bucket, line and shape tools, zoom, pan and rotate, larger canvas presets, undo/redo, and a reference-image layer that is never exported.
- **Pixel-art mode:** a grid canvas (16–256 px), pencil, eraser, fill, eyedropper, mirror symmetry, a palette, and nearest-neighbour export.
- **One deterministic rasterizer** in `packages/shared` (stamp-based brush engine writing into a `Uint8ClampedArray`), used by the browser for display and the server for the published image, so the published pixels come from the log. Add event types for layer operations, brush parameters per stroke, and fill and pixel operations. Bump a format version so old studio pieces still replay.
- **Anti-forgery stats** like the current ones (strokes faster than a hand, impossible event rates, client time vs server receipt time), extended to pressure data (a real pen gives varying pressure; constant 0.5 from a mouse is fine, it just isn't evidence).
- **"Process shown" badge** for outside art: upload a layered file (`.psd` via a vetted parser, `.kra`/`.ora` are zips) or 3 or more WIP images plus the final. The server checks each stage is plausibly an earlier state of the final (perceptual hash and structural similarity increasing toward the final; layers non-trivial). This is a distinct, weaker badge, never the seal. Store the evidence privately with the same encryption and watermark pipeline as uploads (`lib/server/images.ts`, `lib/server/storage.ts`).

## 7. Phase 3: Music (not started)

Current composer: `components/studio/Composer.tsx` (a 16-step × 12-note grid, C major, Web Audio pluck synth in `synth.ts`).

Build:
- **A multi-track piano roll:** tracks with instruments (several synth presets plus a synthesized drum kit; no large sample packs), any number of bars, note length and velocity, chromatic and scale snapping, tempo and time signature, mute/solo/volume/pan, loop region, and an arrangement view.
- **Performance input:** computer keyboard and **Web MIDI** keyboards, recorded live into the log (human timing jitter and velocity are real evidence; quantisation is a separate, recorded edit).
- **Microphone tracks** (the owner said yes): record with `MediaRecorder`, chunk the audio (~2 s) and hash each chunk into the chain with server receipt times. Store the audio encrypted (private bucket, as for music uploads) and serve it only through viewer-bound signed URLs. Mind Supabase storage and bandwidth costs: cap recording length and size, and say so in the UI. Mic input proves a live take happened in the app; it doesn't prove it wasn't played back from another device, so say that honestly on the certificate page.
- **Export:** WAV (offline render with `OfflineAudioContext`) and MIDI. The published piece is rendered from the log.

---

## 8. Other open items (not part of the big task)
- **Code Dojo "Submit" in production** needs a hosted code sandbox (Piston or Judge0). Locally it works with `CODE_RUNNER=piston`.
- **Before a public launch:** set `HM_DEMO_MODE=false` and `HM_DETAILED_AUTH_ERRORS=false` in Vercel.
- **Music uploads** need ffmpeg for previews. An `ffmpeg-static` install was declined earlier; don't work around that without the owner's approval.
- The shared demo account contains test pieces and drafts; the owner may want them cleaned up.

## 9. Gotchas learned the hard way
- **Text projection is sacred.** `pmDocToText` (`packages/shared/src/provenance/pmText.ts`) must produce identical output in the browser and on the server (which validates content against `editorExtensions()` in `lib/server/pm.ts`). Any new node must either add nothing to the projection or project deterministically. The server rejects a batch if content and log disagree.
- **Demo mode** sends every signed-out page visit through `/auth/demo`. Tests that load public pages must follow that redirect (see `publicPage()` in `apps/web/test/e2e-live.ts`).
- **Headless Chromium** can capture CSS animations at their first frame, so the menus look see-through in screenshots. Typing fast with puppeteer after pressing Enter can land in the previous input; wait about 400 ms.
- The machine can reboot and wipe the scratchpad, so keep durable scripts in the repo or recreate them. The earlier layout audit (overlaps, touching controls, sideways overflow at 1440px and 390px, via `puppeteer-core` and `/usr/bin/chromium-browser`) is worth recreating before each push.
- In `apps/web`, use Tailwind v4 classes, `lucide-react` icons, and the existing primitives (`btn`, `chip`, `card`, `input`, `HubHeader`, `IndexRow`, `TitleField`).
