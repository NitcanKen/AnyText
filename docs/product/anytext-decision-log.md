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

Current blocker:

- In-app Browser verification could not be completed because the Browser runtime rejected `http://localhost:5173/AnyText/` under its URL policy. The requested desktop/mobile/two-browser-profile UI verification is therefore still unproven even though CLI tests, build, Supabase RPC, RLS, and realtime smoke checks pass.
