# Humagination architecture and contributor guide

**Read this before asking a coding agent to change the repository.** This is the single-file map of the current product, its implementation, and the rules that keep contributions compatible. `README.md` explains features and demo usage; `DECISIONS.md` records why earlier proposals were accepted, reworked, or rejected. Relevant source files and tests remain the final authority.

## 1. The product contract

Humagination helps people learn and create with their own minds. The app is deliberately **AI-free at runtime**. It does not call language models, image models, AI SDKs, hosted inference APIs, or heuristic “AI detectors,” and it does not present a score as proof that work was made by a human.

Four rules outrank individual feature requests:

1. **Coach, do not replace the learner's work.** Math, code, and writing feedback is deterministic. StepCheck points out the first bad line, Code Dojo explains errors and grades hidden tests, and RedPen identifies writing issues without rewriting the text. There is no “show solution” shortcut.
2. **Prove provenance with recorded creation, not AI detection or effort thresholds.** Creation-record certificates come from hash-chained events received by the server, replayed to non-empty final work and checked for integrity and timing/plausibility before Ed25519 signing. They do not prove humanity or absence of other tools. Uploads may be shared in Art or Music but never receive that seal.
3. **Authenticate and authorize every trust-sensitive action.** A caller-supplied `user_id`, username, email, or profile id is not an identity. Use the Supabase-auth user, owner-scoped RLS, and existing route security helpers.
4. **Preserve compatibility.** Do not remove existing routes, old problem ids, saved progress, certificate verification, or user privacy protections to make a new feature simpler. Keep changes focused and add tests rather than rewriting unrelated code or weakening assertions.

Tutor and Portfolio are different products:

- **Tutor → Writing** (`/tutor/writing`) is for drafts, RedPen, genre coaching, and the rich writer.
- **Portfolio → Words** (`/portfolio/words`) is for finished publications, authors, reading, comments, likes, and certificates. It contains no tutoring controls.
- `/portfolio/writing` redirects to `/portfolio/words`; the database/API work kind remains `writing` for backward compatibility.

## 2. Repository and runtime map

This is a pnpm monorepo. The web application is Next.js 15 App Router with React 19, TypeScript, Tailwind CSS v4, Supabase, TipTap, mathjs/nerdamer, and KaTeX. The browser extension is Chrome Manifest V3. Pure shared logic lives in one workspace package.

| Path | Responsibility |
|---|---|
| `apps/web/src/app` | Next.js pages and Route Handlers (`route.ts`) |
| `apps/web/src/components` | Server/client UI components, writer, math, studio, portfolio |
| `apps/web/src/lib` | Authentication, HTTP security, server queries, encryption, media, pagination helpers |
| `apps/web/src/lib/supabase/server.ts` | Per-request Supabase client acting as the signed-in user; RLS applies |
| `apps/web/src/lib/supabase/admin.ts` | Service-role client for already-authorized server reads and tamper-sensitive writes; server-only |
| `apps/web/test` | Web unit/integration tests and `e2e-live.ts` live user journey |
| `apps/extension` | Chrome extension source, accounting logic, popup/options UI and tests |
| `packages/shared/src` | Pure deterministic logic shared by web, extension and tests |
| `packages/shared/courses/math` | Six complete 12-unit math curricula with unit-aligned problems |
| `packages/shared/problems/math` | The 59 legacy math exercises, retained for old links and progress |
| `packages/shared/src/math` | Math parser, equivalence, solution sets, hints, checking and course aggregation |
| `packages/shared/src/code` | Code exercise definitions and deterministic grading/error explanation |
| `packages/shared/src/provenance` | Writer event chain, replay, statistics and certificate types |
| `packages/shared/src/creation.ts` | Art/music creation event and replay protocol |
| `supabase/migrations` | Ordered Postgres schema, RLS, privileges and database functions |
| `scripts` | Repository checks and maintenance scripts; nothing here should contain secrets |
| `README.md` | Feature guide, commands, known limitations and demo instructions |
| `DECISIONS.md` | Architectural rationale and teammate contribution dispositions |

Path aliases are `@/` for `apps/web/src` and `@hm/shared/<path>` for shared code. Keep pure algorithms in `packages/shared`, browser-only event handling in client components, and trust-sensitive decisions in server routes.

The production deployment is Vercel project `humagination`, rooted at `apps/web`, auto-deployed from `main`. Supabase stores Auth users, application tables, and private media. Do not print or copy credentials into documentation, commits, logs, tests, or pull requests.

## 3. How a request works

### Page requests

1. `apps/web/src/middleware.ts` blocks known AI crawlers, creates a per-request CSP nonce, refreshes the Supabase session, sets security headers, and handles optional demo sign-in.
2. A protected server page calls `requireUserPage()` from `apps/web/src/lib/auth.ts`.
3. `currentUser()` uses Supabase `auth.getUser()` to validate the JWT with Supabase Auth. It deliberately does not trust cookie contents through `getSession()`.
4. The page uses `supabaseServer()` for owner-scoped reads under RLS. `supabaseAdmin()` is used only after identity and ownership/visibility have been established, or for tightly controlled server-only tables.
5. Server Components pass only public view models to Client Components. Secret answers, encryption keys, private originals, and service credentials are excluded.

The root layout already provides the primary `<main>` landmark. Page components must not add nested `<main>` elements.

### State-changing API requests

Route Handlers use the existing helpers in `apps/web/src/lib/http.ts`:

- `api(...)`: converts known errors and Zod failures to safe JSON without leaking internals.
- `requireUser()`: returns the verified user or throws 401.
- `assertSameOrigin(req)`: rejects missing/cross-origin mutations as CSRF protection.
- `parseJson(req, schema, maxBytes)`: validates input with Zod and caps the body.
- `rateLimit(rule, key)`: uses Postgres token buckets, with per-instance fallback; keys are hashed.
- `json(...)`: emits `Cache-Control: no-store`.

A typical mutation verifies the user, checks Origin, validates and caps input, applies a limit, checks ownership in server code or through the query, and only then writes. Do not create an independent authentication or scoring service to bypass this architecture.

The existing client-side `apiFetch` helpers are not authorization. Server validation is always required.

## 4. Data, RLS and trust-sensitive writes

The authoritative schema is `supabase/migrations`. Every application table enables RLS. Privilege revocations and grants are as important as policies; see migrations 1, 4 and 5 before changing access.

Important groups include:

| Data | Tables / models | Write boundary |
|---|---|---|
| Profiles/social | `profiles`, `follows`, `friends` | Owner-scoped policies and column grants |
| Math progress | `tutor_progress`, `tutor_attempts` | Owner reads; trusted API writes |
| Code progress | `code_progress`, `code_attempts`; passing code encrypted for Rosetta | Owner reads; trusted grading API writes |
| Tracker and points | `tracker_daily`, `think_first_daily`, `human_time_daily`, `points_ledger`, `leaderboard_weekly` | Owner reads, server-controlled accounting, uniqueness and daily caps |
| Writer | `documents`, `document_batches`, `certificates` | Owner drafts/history; server replay/finalization writes |
| Gallery/social | `gallery_items`, `likes`, `comments`, `reports` | Visibility/owner RLS; private original media |
| Art/music creation | `creation_sessions`, `creation_batches`, linked certificates | Server chain/replay/finalization |

`points_ledger` enforces uniqueness per `(user_id, reason, ref)`. Shared scoring code also applies daily limits. Repeating an identical request must not farm points. Never introduce process-local dictionaries as alternate ledgers: they disappear on restart, diverge across serverless instances, and bypass RLS.

For schema work:

1. Read the current tables, policies, triggers and grants before writing a migration.
2. Add an ordered migration; do not rewrite already-applied history.
3. Enable RLS and follow deny-by-default, least-privilege grants. Avoid unnecessary security-definer functions.
4. Preserve existing ids and old rows. Additive/backward-compatible migrations are preferred.
5. Exercise cross-user access, not just the happy path, in `apps/web/test/authz.test.ts`.
6. Use Supabase migration tooling for live application only after local review. Do not run SQL that reads server files or executes operating-system commands.

## 5. Tutor implementation

### Math (`/tutor/math`)

Relevant code:

- `packages/shared/src/math/parse.ts`: normalized, allow-listed math input; rejects assignments, unknown functions and arbitrary symbols.
- `equivalence.ts`: symbolic and seeded numerical expression equivalence, real solution-set comparison and root verification.
- `check.ts`: line-by-line checking, final-form validation and public problem projection.
- `hints.ts`: deterministic sign, one-sided operation, partial distribution, division and arithmetic mistake detectors.
- `courses.ts`: imports the six semester course JSON files and flattens unit problems.
- `problems.ts`: combines all 59 legacy problems and 338 new unit-aligned problems into 397 unique ids.
- `apps/web/src/app/tutor/math/[slug]/page.tsx`: semester outcomes, unit objectives, progress, practice grids, Extra practice and individual problem pages.
- `app/api/tutor/math/check/route.ts`: authenticated server-side checking, attempts, hints, progress and points.

There are **72 instructional units**, with at least four new problems in each. New content follows `MathProblem` and `MathCourse` in `packages/shared/src/math/types.ts`. `value` problems require a server-only answer; use `publicProblem()` before passing any problem to the browser. Equation answers must include every real solution. Antiderivatives require `+ C`; partial derivatives list constant symbols; final forms must be supported by the current checker.

Preserve legacy ids and old links. Validate new course content with:

```sh
node scripts/check-math-course.mjs --all
pnpm exec tsx scripts/check-math-course-answers.ts --all
```

### Code (`/tutor/code`)

Exercises and aligned Python/C/Java concept ladders live in `packages/shared/src/code`. Python Run uses Pyodide in a browser worker with a timeout. All Submit grading is server-side against visible and hidden tests; hidden details must not reach the browser. Hints unlock after repeated failed submissions. Error explainers are deterministic rules.

The documented production limitation is that a hosted code sandbox is needed for full Submit support. Do not replace sandboxed execution with arbitrary shell execution, unbounded source input, or browser-only “passing” that can award progress fraudulently.

### Writing (`/tutor/writing` and `/write`)

RedPen and genre coaching are deterministic shared functions. The rich writer uses TipTap for pages, styles, tables, citations, comments, find/replace, outline, history, DOCX export, and print/PDF. `docMeta.ts`, `citations.ts`, and editor schema utilities define the supported structures.

Every editing event is hashed and sent in ordered batches. The server independently recomputes the chain and replays the event content. Formatting-only saves use the canonical-content fingerprint/CAS check; they do not invent typing events. A finalized certificate includes a sanitized rich `doc_json` snapshot with frozen citations and no private comments, and its plain-text projection must exactly match the replayed text. Older certificates keep plain-text rendering.

Known limitations: on-screen pagination is approximate; one block taller than a page can overflow a sheet; footnotes display as endnotes on screen while DOCX exports real footnotes. Do not claim pixel-perfect browser/Word parity.

## 6. Portfolio and authenticity

### Shared behavior

Art, Words and Music support likes and comments subject to visibility and ownership rules. Owners can unpublish or delete. Public profile visibility is not permission to alter another user's work. UI state alone is never persistence: social contribution or progress must use the appropriate authenticated API and database policies.

Only in-app work with a non-empty final replay and passing integrity, plausibility and receipt-timing checks receives the creation-record seal. Count and active-time minimums are not used. Word publishing requires an owned passing writing certificate. Art studio work is server-rendered from stroke events. Music is rendered from note events. Creation finalization rejects cleared/undone-empty results, checks chain integrity, event plausibility and server receipt timing, then signs the certificate.

Uploads are explicitly unsealed. Do not introduce EXIF checks, vocabulary-frequency heuristics, pixel smoothness, paste counts, or another scoring heuristic as “100% human verified.” Those signals are editable, unreliable for honest students, and contradict the product contract.

### Media and privacy

- `app/api/gallery/upload`: authenticated same-origin, rate-limited, size/type checked; image magic bytes are checked.
- Image processing normalizes/re-encodes files, strips metadata, detects duplicates and creates ownership watermarks.
- Original images are encrypted and stored privately; they are not served directly.
- `/api/media/[id]` issues short-lived, signature- and viewer-bound access. Previews contain viewer watermarks.
- Audio has analogous private/signed handling. The browser recorder converts microphone input into canonical mono PCM WAV; only that strict no-extra-chunks format can bypass ffmpeg and be served as a signed WAV preview. Other audio still uses the existing transcoding path. Recorder uploads remain unsealed and never add creation events.
- CSP `connect-src 'self'` prevents the frontend from quietly sending work to an outside inference service.
- Portfolio responses carry crawler refusal headers/meta directives. These are deterrents, not a claim that all copying is technically impossible.

Do not expose original EXIF, private comments, document sources, behavioral histories, or private media to arbitrary origins. A broad CORS wildcard is not a substitute for authentication and is usually unnecessary in this same-origin app.

## 7. Dashboard and browser extension

The Chrome extension records only `{ date, domain, seconds }` for active time on configured AI domains—not URLs, page content, prompts or keystrokes. Focused-tab, focused-window and idle state matter. Chrome alarms are not the sole accounting mechanism; event handlers and heartbeat accounting apply caps to gaps and suspended workers.

The extension obtains a revocable bearer token. `/api/tracker/ingest` resolves that token to a server-verified user; it does not accept an arbitrary profile id. Incremental daily maxima prevent reinstall duplication. The dashboard computes Human Points, reliance and streaks from stored tables and tutor/writing activity. The leaderboard is opt-in and labels extension time as self-reported motivation, not proof.

Do not widen collection to full URLs, prompts, keystrokes or page contents. Do not invent points through popup-only state or unauthenticated status endpoints.

## 8. UI, typography and brand conventions

- Light parchment/cream surfaces, navy text and primary buttons, sun/orange accents; use existing semantic CSS tokens in `app/globals.css`, not one-off palette replacements.
- Source Sans 3 is the self-hosted UI body font and Playfair Display is the self-hosted application/display-heading font. A separate book-serif token serves long-form writing. Preserve the writer's document-font catalog, including Bricolage, and scope application display rules so they do not override published MLA/APA documents or replay text. Fonts must satisfy the same-origin CSP; do not add a third-party font origin.
- Reuse `btn`, `chip`, `card`, `input`, `HubHeader`, `IndexRow`, `TitleField` where appropriate and `lucide-react` for icons.
- Every responsive grid starts with `grid-cols-1`; use `min-w-0` around shrinking text/math and wrapping flex groups. A math display may itself scroll, but the document must not overflow horizontally at 320px.
- Use native links/buttons, visible focus, accessible names, semantic headings and visible status text rather than color alone. Avoid nested `<main>` landmarks.
- Preserve `noai/noimageai` portfolio metadata and viewer watermark layers.
- Keep sentence-case, plain and specific copy. Avoid unsupported words such as “verified,” “secure,” or “complete” for features that do not actually establish those claims.
- Brand assets are generated by `apps/web/scripts/brand-assets.mjs`; do not casually distort the lockup or reintroduce undersized mobile navigation.

## 9. Environment and external services

Environment variable **names** are documented in `README.md`; values are not. The local environment file is intentionally ignored and must never be read into a pull request, log or committed example. Public Supabase URL/anon key are separate from the service-role, media, encryption, signing, watermark and extension-token secrets.

`HM_DEMO_MODE=true` makes signed-out page visits use a shared demo account. It is convenient for evaluation but must be disabled for a real public launch, along with detailed auth errors. Tests account for this behavior through `/auth/demo`.

Do not add AI packages or model hostnames. `scripts/no-ai-check.mjs` enforces the rule, and `scripts/no-service-role-in-client.mjs` checks client boundaries. New dependencies require an exact pinned version, license check, release-age review and an actual architecture reason.

## 10. Tests and delivery workflow

Run from the repository root:

```sh
pnpm test                       # all unit/integration tests, including live-RLS suite when configured
pnpm lint                       # no-AI, client service-role, ESLint and TypeScript
pnpm e2e:live http://localhost:3000
pnpm --filter web build
git diff --check
```

The live E2E script creates and deletes a throwaway account. Keep it broad: auth, math, code, document provenance/finalization, publishing, private media signatures, comments/likes, art/music replay, extension tokens, dashboard, and account deletion. Add checks for behavior you change; never delete a failing assertion merely because the implementation changed.

Before production builds, **stop development servers**. The repository is memory-constrained enough that running both can fail. Do not use a broad `pkill -f` command that can kill your own process; identify the server PIDs.

For every substantial change:

1. Read this file, relevant source, `README.md`, `DECISIONS.md`, and existing tests.
2. Explain how the change fits the current identity, data and provenance flow before coding.
3. Make the smallest compatible change; avoid whole-file reformatting and parallel versions of existing systems.
4. Add positive, negative, boundary and cross-user tests appropriate to the risk.
5. Review at desktop and a phone width (and 320px for long navigation/content), keyboard flow, console errors and overflow.
6. Run all checks above. Say exactly what was and was not verified.
7. Update the docs affected by your change. Do not commit or push unless the owner has authorized that git mutation.

## 11. Common reasons contributions are deflected

These are correctable architecture mismatches, not personal judgments about a contributor:

1. **A detector replaces proof with a heuristic.** Authenticity must use the existing recorded/replayed certificate paths. An informational, non-consequential experiment still needs an explicit product decision and must never become “100% human verified.”
2. **A caller chooses whose data or points to change.** `req.body.user_id` is attacker-controlled. Resolve the user through `requireUser()` or a revocable extension token and enforce owner checks in code/RLS.
3. **A parallel service duplicates tracker, points or progress.** Use the existing durable tables, RLS, per-work uniqueness, daily caps and route helpers. Process memory is not authoritative application state.
4. **Wildcard CORS exposes behavioral data or mutations.** The app is same-origin; use `assertSameOrigin()` for browser mutations and authenticated, narrowly scoped protocols where a separate service is genuinely needed.
5. **There are no input schemas, size limits or rate limits.** Use Zod, `parseJson` caps, upload byte/magic checks, and shared `rateLimit` rules. Bound collections and stored arrays as well as request bodies.
6. **The browser receives secrets or trust decisions.** Keep math answers before checking, hidden code tests, private originals, service credentials and internal certificate data on the server. Never import `supabaseAdmin` into a client module.
7. **Uploads get authenticity certificates automatically.** They must remain unsealed. Only in-app replay evidence can earn the seal.
8. **The change works only in React state or only on the author's machine.** Existing users need durable owner-scoped data, compatible routes, a deployment path and tests. A root-level standalone Python file is not integrated with the `apps/web` Vercel deployment.
9. **The PR weakens or duplicates existing behavior.** Preserve `/tutor/writing` vs `/portfolio/words`, legacy math ids, RLS, CSP, certificate compatibility, signed media and existing validation. Do not replace robust code with a smaller demo merely to resolve conflicts.
10. **Tests or documentation are made less truthful to obtain green checks.** Add independent coverage; do not loosen assertions, mislabel counts, claim credit/accreditation, or conceal known limitations.

When a PR mixes useful design/content with unsafe infrastructure, the preferred path is to salvage the useful portion and rebuild only the trust-sensitive part within this architecture. Review the whole diff before doing so so duplicated or weaker replacements are not merged by accident.

## 12. Known limitations and future-work boundaries

Read the current Known limitations section of `README.md` before claiming production readiness. In particular: hosted code execution is needed for production Code Submit, demo mode is not a public-launch configuration, browser writer pagination differs from print/DOCX, and course pathways are guided practice rather than college credit or replacements for instruction and assessment.

Layered/pixel-art studio expansion, richer music input and “Process shown” evidence for outside art are future design ideas in `HANDOFF.md`, not implemented capabilities to reference as though they exist. Keep future work on the existing provenance, privacy and server-replay architecture.
