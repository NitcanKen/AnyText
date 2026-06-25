# AnyText Decision Log

## Current Status

This document records product and design decisions already aligned with the user. Treat these decisions as the current source of truth unless the user explicitly changes them.

## Confirmed Product Decisions

- MVP is for one person's owned devices.
- Target devices: MacBook, iPhone, iPad, Windows, and other computers through a Web App.
- Primary use case: immediate cross-device relay, not long-term storage.
- First version uses manual paste/drop/select and `Send`.
- Clipboard monitoring is out of scope.
- System share extension is out of scope.
- Account login is out of scope.
- Device pairing happens once per device through QR code or pairing code.
- Repeated QR scan for every transfer is not acceptable.
- Room key is saved in browser `localStorage`.
- Queue items expire after 1 hour.
- Queue can contain multiple items.
- Any paired device can manually delete a queue item.
- A message can include Markdown text plus multiple attachments.
- Markdown must support developer-oriented preview, syntax highlighting, and per-code-block copy.
- Images can be previewed.
- Other documents are download-only.
- MVP limits: 500KB Markdown, 25MB per attachment, 10 attachments per message.

## Confirmed Technical Direction

- Frontend is a static Web App hosted on GitHub Pages.
- Frontend framework direction is Vite + React + TypeScript.
- Styling direction is Tailwind CSS.
- Supabase is the backend.
- Supabase handles Postgres metadata, Storage, and Realtime.
- No Supabase Auth in MVP.
- Authorization model uses a high-entropy room key.
- Database should use `sha256(roomKey)` as room identifier rather than storing the raw room key.
- MVP is not end-to-end encrypted.
- Supabase project administrators can theoretically read stored content.
- Product copy must warn against transferring passwords, private keys, or long-term sensitive data.
- Prefer Edge Functions or restricted RPC as the data boundary instead of direct unrestricted table access.

The technical framework is documented in:

- `docs/technical/anytext-technical-framework.md`
- `docs/technical/anytext-supabase-project.md`

The development sequence is documented in:

- `docs/planning/anytext-development-sequence.md`
- `docs/planning/anytext-goals.md`

## Confirmed Supabase Project

Verified from the user's logged-in ChatGPT Atlas / Supabase dashboard window on 2026-06-24:

- Supabase organization: `NitcanKen's Org`
- Supabase project name: `AnyText`
- Supabase project ref: `cizmpumlliowigimhwqr`
- Expected project URL: `https://cizmpumlliowigimhwqr.supabase.co`

Keep real anon/publishable keys, access tokens, and service role keys out of committed files. Use local or deployment environment variables.

## Confirmed UI Direction

Selected direction: **Version 1: Command Deck**.

Command Deck is a dark, compact, developer-first interface for Markdown, code, commands, images, and files. It uses a two-column desktop layout:

- Left: composer.
- Right: queue and selected item detail.

This direction is documented in:

- `docs/design/command-deck-ui-design.md`
- `docs/design/command-deck-ux-interactions-motion.md`

## Generated Concept Images

The concept images are preview references only. They are not implementation source files.

- Version 1 Command Deck: `/Users/ken/.codex/generated_images/019ef48a-4d30-7423-8148-e94b5599a041/ig_01add6d0010109e3016a3a8c770a40819888020991e5c7c89c.png`
- Version 2 Relay Pad: `/Users/ken/.codex/generated_images/019ef48a-4d30-7423-8148-e94b5599a041/ig_01add6d0010109e3016a3a8cbc01d08198b2858685740007c1.png`
- Version 3 Split Courier: `/Users/ken/.codex/generated_images/019ef48a-4d30-7423-8148-e94b5599a041/ig_01add6d0010109e3016a3a8d0798bc8198b5349feda07310b5.png`
- Version 4 Inbox Zero: `/Users/ken/.codex/generated_images/019ef48a-4d30-7423-8148-e94b5599a041/ig_01add6d0010109e3016a3a8d54904c819880c5d7cd0fe317b0.png`

## Rejected Directions

- Full Notion-like editor.
- Full file manager.
- Long-term archive.
- Team collaboration.
- Public sharing links.
- Account-based SaaS.
- Native app first.
- Text-only MVP.
- Attachment-only MVP.
- Dense dashboard UI.
- Generic light SaaS UI.

## Open Questions For Next Alignment

These should be aligned before implementation planning:

- Supabase access pattern: Edge Functions only, RPC only, or hybrid.
- Storage URL strategy: signed URLs versus public unguessable paths.
- Expiry cleanup strategy: scheduled SQL, Edge Function cron, or manual cleanup on read/write.
- Exact Markdown renderer and syntax highlighting libraries.
- Whether to preserve generated concept images inside the repo as references.
- Initial deployment flow for GitHub Pages and Supabase environments.

## Implementation Note: Command Deck Frontend Foundation

Completed on 2026-06-24:

- Created the Vite + React + TypeScript + Tailwind frontend foundation with `dev`, `build`, `lint`, `test`, and `preview` npm scripts.
- Configured the frontend for GitHub Pages under `/AnyText/`.
- Kept Supabase as environment placeholders only; no Supabase client, backend, secrets, or real storage integration was added in this goal.
- Implemented tested local helpers for high-entropy room key generation, `sha256(roomKey)` room ID hashing, Markdown 500KB validation, attachment count and 25MB validation, image/download classification, file-size formatting, one-hour expiry, and active mock queue filtering.
- Implemented the Command Deck UI direction: first-run create/join surface, pairing placeholder panel, compact top bar and room menu, desktop Compose/Queue two-column layout, mobile Send/Queue tabs, Markdown composer, drag/select attachment handling, inline validation, upload/send states, empty/loading/error/disconnected queue states, local delete, and local expiry hiding.
- Implemented Markdown preview with GFM tables, blockquotes, inline code, sanitized HTML/script handling, Prism syntax highlighting, raw Markdown copy, per-code-block copy, and stronger shell/command block treatment.
- Implemented local mock queue behavior for adding, selecting, expanding, deleting, and hiding expired items. Local image previews and file downloads use browser object URLs only.

Intentional deviations or placeholders:

- Pairing QR is a visual placeholder for this frontend-only goal; real QR generation can be added with the full pairing phase.
- The queue shows a `Realtime disconnected` warning because this goal intentionally does not connect Supabase Realtime.
- Upload progress is a local mock send-state rail; real per-file upload progress belongs to the Supabase attachment phase.
- Production build currently emits a non-failing Vite/Rolldown warning about the large Tabler icon barrel module. It does not block the static build, but can be optimized later with import rewriting if build time becomes material.

## Implementation Note: Supabase Metadata Text Relay

Implemented on 2026-06-24:

- Added Supabase migrations for `rooms`, `messages`, and `attachments` metadata, including indexes for active room queue reads, expiry scans, and attachment foreign-key access.
- Added a private `anytext-attachments` storage bucket placeholder with a 25MB file-size limit. Attachment upload/download remains intentionally out of scope for this text relay goal.
- Chose restricted Postgres RPC as the backend boundary for this phase instead of Edge Functions. The browser calls only `anytext_create_room`, `anytext_list_messages`, `anytext_create_message`, and `anytext_delete_message`; raw room keys are never sent to or stored in the database, and `room_id` is `sha256(roomKey)`.
- Enabled and forced RLS on `rooms`, `messages`, and `attachments`, revoked direct anon/authenticated table access, and granted anon/authenticated execute only on the restricted RPC functions.
- Added Supabase Realtime through database-triggered private broadcasts on `anytext:room:{room_id}`. Realtime authorization uses `realtime.topic()` and allows anon/authenticated clients to receive only AnyText room broadcast topics.
- Implemented frontend room persistence and pairing helpers for first-run create, join by URL/manual code, localStorage room key persistence, device rename, reset browser, copy join link, and QR rendering.
- Replaced the local mock send/list/delete path with Supabase text-only RPC calls. The app loads active queue items first, subscribes to realtime broadcasts, merges insert/update/delete events, shows disconnected warnings, and supports manual refresh.
- Kept Goal 1 Markdown rendering and safety behavior: GFM, tables, blockquotes, inline code, syntax highlighted code blocks, per-code-block copy, raw Markdown copy, and HTML/script sanitization.
- Disabled attachment selection in the UI for this phase to avoid implying partially working upload/download behavior.

Local environment setup:

- Keep real values only in ignored `.env.local` or deployment environment variables.
- Required frontend variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- `SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`, and `SUPABASE_SERVICE_ROLE_KEY` stay local/CLI-only and must not be committed.
- Migrations are applied with `supabase db push --linked` after the CLI is logged in and linked to project `cizmpumlliowigimhwqr`.

Verification completed:

- `supabase db push --linked --dry-run` showed only the AnyText migration pending before deployment.
- `supabase db push --linked --yes` applied both backend migrations successfully.
- An anon-key RPC smoke test created a room, created a Markdown message, listed it, soft-deleted it, and confirmed the post-delete list was empty.
- The same anon-key smoke test confirmed direct broad `messages` table select is blocked with Postgres error code `42501`.
- A two-client Supabase Realtime smoke test confirmed one client receives INSERT and soft-delete UPDATE broadcasts caused by another client's RPC calls.

Additional verification completed after merge to `main`:

- Confirmed `main` is aligned with `origin/main` and the Supabase project `cizmpumlliowigimhwqr` is linked and `ACTIVE_HEALTHY`.
- Confirmed remote migrations `20260624143000` and `20260624145500` are applied.
- Re-ran `npm run lint`, `npm test`, and `npm run build` successfully.
- Verified anon/publishable clients cannot directly read `rooms` or `messages`; both direct table reads are blocked with `permission denied`.
- Verified two isolated browser profiles against the local app and real Supabase backend: create room, join by link, refresh persistence, send Markdown with two code blocks, realtime insert sync, exact per-code-block copy, script sanitization, and delete sync.

Current blocker:

- None for Goal 2. Attachment upload/download, signed URLs, and storage cleanup remain intentionally deferred to Goal 3.

## Implementation Note: Supabase Attachment Content Model

Implemented on 2026-06-24:

- Completed the MVP content model: one message can include Markdown plus up to 10 attachments, with a 500KB Markdown limit and a 25MB per-file limit enforced in both frontend validation and restricted backend RPC.
- Added attachment upload metadata fields: `upload_status`, `uploaded_at`, `upload_error`, and `cleanup_pending`.
- Added safe storage path generation in Postgres using the required shape: `rooms/{roomId}/messages/{messageId}/{attachmentId}-{safeFileName}`. The original filename is preserved only as metadata; storage paths use a sanitized filename segment and a server-generated attachment UUID.
- Hardened safe filename generation after fresh verification found an unsafe `..` segment could remain inside the sanitized filename. Repeated dot sequences are now removed before upload targets are generated.
- Replaced text-only `anytext_create_message` with a message-plus-attachment RPC. It creates the message, validates attachment count/size, conservatively classifies common images as `image` and everything else as `download`, registers pending attachment metadata, and returns upload targets.
- Added `anytext_mark_attachment_uploaded` and `anytext_finalize_message_uploads`. The frontend only shows finalized uploaded attachments in normal list/detail views.
- Added a private Storage INSERT policy for `anytext-attachments` that allows uploads only to an active pending attachment path already registered by backend metadata. The policy uses a `security definer` helper so anon clients do not receive direct `attachments` table read access.
- Added the `anytext-create-download-url` Edge Function. The browser requests a URL by `roomId`, `messageId`, and `attachmentId`; the function validates the scoped target through RPC and uses the service role server-side to create a short-lived signed Storage URL.
- Kept bucket listing and broad public paths unavailable to the frontend. There is no Storage SELECT policy for broad client reads; downloads and image previews use per-attachment signed URLs.
- Updated delete behavior: `anytext_delete_message` soft-deletes the message, soft-deletes its attachments, and marks attachment rows `cleanup_pending = true`. Physical Storage removal remains a later cleanup job, but user-facing list/download access is blocked immediately after delete.
- Re-enabled composer attachment selection with drag/drop and file picker support. Selected files show per-file status/progress rails, can be removed, and are retained on failed send so the user can retry or remove them.
- Queue/detail views now show attachment counts, image thumbnails, large image preview modal, signed download actions, and download-only rows for PDF/zip/doc-style files.

Storage URL strategy:

- Upload: backend RPC registers a pending attachment row and returns one exact `storage_path`; the frontend asks Supabase Storage for a signed upload URL for that path. The Storage INSERT policy rejects paths without matching active pending metadata.
- Download/preview: frontend never signs Storage paths directly. It invokes `anytext-create-download-url`, which validates room/message/attachment scope and returns a short-lived signed URL for one object.
- Broad listing: anon Storage list calls do not expose objects or prefixes for `anytext-attachments`.

Delete and cleanup strategy:

- Manual delete immediately hides the message from all normal list queries and realtime-connected devices.
- Attachment metadata is soft-deleted and marked `cleanup_pending` during the same backend delete flow.
- Physical object deletion is intentionally deferred to a scheduled cleanup phase so the MVP does not require exposing service-role cleanup logic to the browser.

Verification completed:

- `npm run lint && npm test && npm run build` passed after the attachment implementation. Vitest covered 5 files and 30 tests.
- `supabase db push` applied migrations `20260624160000` and `20260624162000` to project `cizmpumlliowigimhwqr`.
- Fresh verification on 2026-06-25 applied migration `20260625003000` to harden attachment safe filenames.
- `supabase functions deploy anytext-create-download-url` deployed the Edge Function to the linked project.
- Real Supabase smoke verified: message creation with image/PDF/zip metadata, signed upload URL creation, Storage upload, mark uploaded, finalize, list with 3 attachments, image and file signed URLs fetch with HTTP 200, too-many and over-25MB backend rejection, delete hiding, post-delete download URL rejection, and `cleanup_pending` on all deleted attachments.
- Fresh verification on 2026-06-25 re-ran the real Supabase smoke after filename hardening and confirmed unsafe original filenames no longer leave `..` segments in storage object keys.
- Browser verification used the in-app Browser for desktop/mobile layout, signed attachment rendering, image preview modal, file download links, and two-tab delete sync. The in-app Browser file upload API was not available, so Google Chrome headless through CDP was used for the file-picker-specific checks without adding repo dependencies.
- Chrome CDP browser verification covered Markdown+image send, Markdown+PDF+zip send, signed download anchors, more-than-10 attachment inline validation, over-25MB inline validation, reduced-motion media emulation, and basic Tab focus entry.
- Fresh browser verification on 2026-06-25 covered two isolated profiles, Markdown+image/PDF send, image preview modal, PDF/zip signed URL fetches with HTTP 200, more-than-10 and over-25MB inline validation, reduced-motion mobile viewport, delete sync, and clean console output.

Known follow-up:

- A scheduled physical Storage cleanup job is still needed for expired/deleted rows with `cleanup_pending = true`.
- Production build still emits the non-failing Tabler barrel/chunk-size warning noted in earlier goals.

## Implementation Note: MVP Expiry, Cleanup, UX Polish, and Deploy Prep

Implemented on 2026-06-25:

- Added a deployable physical cleanup path:
  - `anytext_cleanup_attachment_candidates(p_limit)` returns expired/deleted/cleanup-pending attachment storage paths for the service role only.
  - `anytext-cleanup-expired` Edge Function deletes matching Storage objects, then calls `anytext_cleanup_finalize(p_attachment_ids)` to delete attachment records and expired/deleted messages with no remaining attachments.
  - The cleanup function requires `ANYTEXT_CLEANUP_TOKEN` and is intended to be scheduled server-side, not called from the browser.
- Preserved the user-facing expiry contract:
  - Normal queue lists continue to hide expired/deleted items.
  - If an item is already open when it expires, the detail remains visible with an expired state and disabled downloads.
  - Added component coverage for selected-item expiry behavior.
- Improved Command Deck UX/accessibility:
  - Room menu now supports Escape, outside-click close, focus return, menu roles, and arrow/Home/End keyboard navigation.
  - Mobile queue item selection opens a bottom detail sheet instead of relying on the desktop inline detail region.
  - Queue rows, mobile sheet, drag-over state, and new-item entry have restrained motion with the existing reduced-motion override.
  - Delete and icon-only controls have stronger touch/focus affordances, labels, and native tooltips where useful.
- Added GitHub Pages deploy preparation:
  - `.github/workflows/deploy-pages.yml` runs `npm run lint`, `npm test`, and `npm run build`, then deploys `dist` through GitHub Pages.
  - `README.md` documents local setup, Supabase migrations/functions, cleanup scheduling, GitHub Pages variables/secrets, and MVP acceptance checks.
  - `.env.example` now includes the cleanup invocation token placeholder. No service role key or real secret was committed.

Verification completed so far:

- `npm test -- --run src/App.test.tsx` passed after adding the selected-expiry component test.
- `npm run lint && npm test && npm run build` passed before the docs/deploy additions in this goal.
- `npm run lint && npm test && npm run build` passed again after the docs/deploy/code edits in this goal; Vitest covered 5 files and 31 tests.
- `supabase db push --yes` applied migration `20260625013000_anytext_cleanup_expired.sql` to project `cizmpumlliowigimhwqr`.
- `supabase functions deploy anytext-cleanup-expired --no-verify-jwt` deployed the cleanup Edge Function.
- Real cleanup smoke verified shortened expiry with a real uploaded attachment: target attachment row remaining `0`, target message row remaining `0`, and target Storage objects remaining `0` after cleanup.
- In-app Browser verification covered desktop page identity, nonblank Command Deck rendering, no framework overlay, clean console, exact raw Markdown clipboard copy, exact bash code block copy, room menu Arrow/Escape navigation with focus return, mobile Queue tab, mobile bottom detail sheet, and no mobile horizontal overflow.
- Headless Chrome/CDP verification with two isolated browser profiles covered: fresh room creation, second browser join by room link, refresh persistence, Markdown plus image/PDF upload, receiver rendering, image modal signed URL fetch HTTP 200, PDF signed download URL fetch HTTP 200, receiver delete syncing back to sender, shortened-expiry item hidden after refresh, reduced-motion media emulation, and 390px mobile tabs without horizontal overflow.
- Cleanup was invoked again after browser tests to remove smoke messages and Storage objects left by failed intermediate CDP attempts.
- Final `npm run lint && npm test && npm run build` passed after all tracked docs/config/code edits; Vitest covered 5 files and 31 tests.

Production verification completed:

- The repository was made public by the owner so GitHub Pages could be enabled for the current plan.
- GitHub Pages workflow run `28117694163` first proved Pages enablement and deployment from commit `641b153`.
- Production smoke then found a UI formatter issue: a fresh one-hour item could show `2h left` when the remaining time rounded up just past 60 minutes. Commit `82ca942` changed hour display to floor whole hours and added a 61-minute formatter test.
- GitHub Pages workflow run `28118310283` deployed commit `82ca942` successfully to `https://nitcanken.github.io/AnyText/`.
- Fresh production verification after that deploy covered:
  - live Pages HTML title/base path and live bundle containing the fixed formatter;
  - fresh room creation in an isolated browser profile;
  - second isolated browser joining by room link;
  - room persistence after receiver refresh;
  - Markdown rendering with GFM table, blockquote, inline code, highlighted bash/typescript code blocks, and sanitized script content;
  - `1h left` display with no `2h left` on a fresh item;
  - generated image and PDF attachments through drag/drop, queue attachment count `2`, image preview modal with signed Storage URL HTTP 200, and PDF signed download URL HTTP 200;
  - receiver delete syncing back to sender;
  - 390px mobile Queue tab with no horizontal overflow;
  - `prefers-reduced-motion: reduce` emulation with transition duration reduced to `1e-06s`;
  - in-app Browser clipboard verification for exact raw Markdown copy and exact bash code block copy.
- Headless Chrome clipboard readback rejected due browser permission/user-activation constraints, so clipboard assertions were verified through the in-app Browser clipboard API. The application code for copy behavior was unchanged by the final time formatter fix.
- Final local gate before this production deploy passed: `npm run lint && npm test && npm run build` with Vitest covering 5 files and 31 tests. The remaining build output is the known non-failing Tabler barrel/chunk-size warning.

## Implementation Note: Short Manual Pairing Code

Implemented on 2026-06-25:

- Changed new room key generation from a long base64url secret to a 7-character manual pairing code: six digits followed by one symbol from `!@#$%^&*`.
- Kept `sha256(roomKey)` as the backend room identifier; raw room keys are still not stored in Postgres.
- Kept legacy/manual pasted room keys accepted so previously created rooms and older join links are not intentionally locked out by the UI.
- Added tests for the short code format and URL encoding of symbol-bearing join links.

Reason for spec deviation:

- This intentionally trades high entropy for much lower device-join friction. AnyText remains scoped to temporary, low-sensitivity transfer with one-hour expiry, manual delete, and no end-to-end encryption.
