# Decisions

Where the spec was ambiguous, or the environment forced a choice, this file records the simplest secure option chosen.

## Platform
- **Next.js 15.5 (App Router), not 16.** Next 15 is the line the spec's "middleware" wording refers to, and it is still maintained (backport channel). Next 16 renames middleware to `proxy.ts`.
- **Hosted Supabase** is the default during development (the dev machine had little free RAM). The migrations in `supabase/migrations/` work unchanged with `supabase start`.
- **Supabase CLI** isn't installed globally. `pnpm gen:types` calls `supabase gen types`. Install the CLI, or generate types from the dashboard, to fill `packages/shared/src/db.types.ts`.
- **ESLint 9 + typescript-eslint**, in a flat config at the repo root. `pnpm lint` runs the AI check, then the service-role check, ESLint and per-package `tsc`.
- **Tailwind v4** with CSS-first tokens and system font stacks. The CSP is `font-src 'self'`, so no Google Fonts.

## Security
- **Login and signup go through route handlers**, not the browser Supabase client. That way rate limits, lockout and the common-password check are enforced on the server. The app has **no browser Supabase client at all**: every data access goes through route handlers or server components, which shrinks the attack surface.
- **Lockout** state lives in `login_attempts`, keyed by `sha256(email)`, so the table never stores emails. After 10 failures the account is locked for 15 minutes and the counter resets.
- **Rate limiting is in-memory, per process** (the spec asked for an in-memory token bucket). This is documented as a limitation for multi-instance deployments.
- **CSP:** nonce plus `strict-dynamic` for scripts. `style-src` allows `'unsafe-inline'` because TipTap and KaTeX inject inline styles; inline *scripts* stay blocked. `'wasm-unsafe-eval'` appears only in the CSP served with `/workers/pyodide-worker.js`. Dedicated workers get their CSP from their own response, so the page CSP never needs it.
- **Pyodide is self-hosted:** `scripts/copy-pyodide.mjs` copies the runtime from `node_modules` to `public/pyodide`, so `connect-src 'self'` holds and no CDN is involved.
- **The Origin check** accepts the request's own Host, or `NEXT_PUBLIC_SITE_URL` when behind a proxy.
- **Encryption AAD:** each ciphertext is bound to `doc:<id>:<field>`, `work:<id>:<kind>` or `code:<user>:<exercise>`, so a ciphertext can't be swapped between rows.
- **Previews are not encrypted.** The spec asks for encrypted originals and drafts. Previews sit in a private bucket and are only ever served watermarked through the signed route.
- **Signed media URLs are bound to the viewer's id** (as well as the work and expiry), so a leaked URL is useless to anyone else even before its 5 minutes run out.
- **Storage** has no `storage.objects` policies at all, so only the service role can read or write. The RLS test asserts that even owners can't download originals directly.
- **Extension tokens:** `hm_ext_` + 32 random bytes (base64url), stored as `SHA-256(pepper ‖ token)`. At most 5 active tokens per user. The token hash column isn't readable by the `authenticated` role.

## Provenance editor
- **Event positions use a plain-text projection**: `doc.textBetween(0, size, "\n", hardBreak → "\n")`, the same call in browser and server. The server can then replay and verify without ProseMirror steps. Formatting-only changes (bold, etc.) don't alter the text and aren't logged as events.
- **Each transaction becomes one event** via a minimal prefix/suffix diff. `from`/`to` mark the replaced range in the *old* text, `text` is the inserted text, and `len = text.length`.
- **Content and log stay in lockstep.** Every event batch carries the editor JSON. The server replays the batch onto its own encrypted text copy and rejects the batch unless the content projects to exactly that text. So the saved document can never drift from its log, and Finalize can always verify.
- **Multiple sessions:** the chain is continuous across sessions. `h_0` uses the document's *first* session id, and later sessions extend from the stored head. Each batch records its session id, which the timing checks group by.
- **Multiple tabs:** optimistic concurrency on `documents.last_seq`. The second tab gets a 409 and is asked to reload.
- **typedPct is measured on the final text, character by character,** not on insert totals. Otherwise someone could type and delete filler to dilute a paste. Characters restored by undo/redo inherit their original tags, and anything matching previously pasted text counts as pasted.
- **Thresholds:**
  - Injection bursts become a red flag at **3 or more**, because IMEs (Japanese, Chinese) and autocorrect legitimately commit several characters at once.
  - Typing over 120 wpm is measured over the best **60-second window**, at 5 characters per word.
  - "Possible transcription" means ≥ 150 words with a revision ratio < 0.02.
  - Timing is inconsistent if the client claims more than 15 s beyond the server's elapsed time, if one batch spans more than 90 s, or if more than 10 % of characters arrive in batches delayed over 120 s.
- **Finalizing publishes** the text and its log, which the replay needs. The UI says so before you confirm. Documents stay editable after finalizing, and each finalize creates a new certificate.
- **Writing time** is credited once per second written (`documents.credited_seconds`), and only for verdicts other than Unverified.

## StepCheck
- **The server does the checking,** so the stored `answer` never reaches the browser. The client uses mathjs only to preview LaTeX.
- **Input language:** mathjs syntax with implicit multiplication (`2x`), one variable, `sqrt`/`abs` and the constants `pi`/`e`. Unicode `−`, `×`, `÷` and `²` are normalized. Equations may list solutions with `or`, `,` or `;`.
- **Derivative problems:** line 0 is the derivative of the given function (computed with mathjs), and every line must be equivalent to it.
- **Hint order follows the spec, with one guard.** A one-sided operation must be an actual add/subtract/multiply/divide by a constant. A side containing `a(b + c)` that was multiplied out wrongly can differ by a constant by coincidence, and partial distribution explains it better. The extra sign-error variant — moving a term across `=` without flipping it — is the most common sign error in linear equations.
- **Tiers:** tier 1 is shown on the first failure, tier 2 is available after the second, tier 3 after the third. Revealing tier ≥ 2 forfeits the no-hint bonus.
- **Active time** reported by the client is clamped to the wall-clock time since the last check (max 10 minutes).

## Code Dojo
- **One rate-limit token per Run or Submit action** (20/min), plus 5 concurrent runs per user. A submit executes every test, but counting it as one user action matches how students use it.
- **Run versus Submit:** Run uses only the visible tests (or custom stdin). Submit always uses the server. Python's Run uses Pyodide; C and Java Run go to the server.
- **The curriculum is generated** from `scripts/gen-exercises.mjs`, so the 36 JSON files share the same tests and ladder across languages. The ladder:
  - Python's 9th slot is FizzBuzz (loops), because Python has no pointers/memory or interfaces rung.
  - C's 9th slot is pointers & memory.
  - Java's 9th slot is OOP & interfaces.
- **Reference solutions** exist only as test fixtures (`packages/shared/test/fixtures`). They prove the tests are correct and passable on gcc/javac/python and on Piston. The app never imports them.
- **Piston quirks** (found by the live harness), all handled in the adapter:
  - Piston appends the file extension itself, so files are named `main`/`Main`.
  - Java runs with the single-file launcher, which picks the *first* class, so a launcher class is inserted after the imports on the same line (line numbers are kept).
  - Java compile errors arrive as runtime stderr ending in `error: compilation failed` and are mapped to `compile_error`.
- **Judge0 language ids** are CE 1.13.1 defaults: 50 = C (GCC 9.2), 62 = Java 13, 71 = Python 3.8. Sanitizer runs get a 512 MB memory limit because ASan reserves a lot of virtual memory.
- **Typographic quotes:** gcc prints ‘…’ in UTF-8 locales, so they're normalized to ASCII before rule matching.
- **Rosetta view** opens only after you solve the current exercise, and shows only your own saved passing code (encrypted at rest).

## Tracker
- **Chrome's alarm minimum is 30 s,** so a 15 s alarm isn't possible. The extension uses event-driven accounting (tab, window and idle changes) plus a 30 s heartbeat. It credits elapsed time in whole 15-second ticks and carries the remainder over. A gap longer than 60 s since the last event is capped, which covers sleep or a suspended worker.
- **Think First** "Continue" goes to the site's **home page**, so the extension never needs to keep the URL you were heading to. That domain is then allowed for 20 minutes.
- **Ingest** keeps the maximum of the stored and incoming totals per (date, domain). Totals only grow, so a reinstall can't erase recorded time. Dates outside the last 14 days (plus one day of skew) are ignored.
- **Think First points** are awarded per redirect index (`date:n`) up to 10 a day, so syncing the same day again doesn't double-award.
- **Human minutes** = tutor seconds (math checks plus code submits, clamped) + writing seconds (credited on finalize).

## Gallery
- **Duplicate detection:** an exact SHA-256 match, or dHash Hamming ≤ 6, against *other users'* art. Re-uploading your own work is allowed. A blocked upload returns the duplicate's owner and is logged.
- **Music previews** are a 64 kbps MP3 transcoded with **ffmpeg** (no shell, argument array, 60 s timeout). An upload that ffmpeg can't decode is rejected. The 64 kbps preview streams through a viewer-bound signed route; the original is never served.
- **The writing gallery** publishes from a Human-Verified certificate the user owns. The text is replayed from the certificate's log and rendered over a per-viewer watermark layer.
- **Bulk downloads:** more than 300 media fetches in 10 minutes sets `profiles.flagged_bulk` (in-memory counter).

## Data model notes
- `TutorProblem` is backed by JSON files (allowed by the spec). Progress lives in `tutor_progress` and `code_progress`, and every attempt is logged (`tutor_attempts`, `code_attempts`).
- `ThinkFirstEvent` is stored as daily counters (`think_first_daily`) rather than one row per event, which reveals less.
- `leaderboard_weekly` is written by the server whenever stats are computed. Its RLS shows only opted-in rows (plus your own), so the leaderboard needs no security-definer view.
- `human_time_daily` and the atomic counter RPCs (`hm_add_human_time`, `hm_add_think_first`) are callable only by `service_role`.

## Seed
- The seeded certificate comes from a **synthetic typing log** (human-like cadence with typos fixed). Its title says "(seeded demo)" so it can't pass for a real attestation.
