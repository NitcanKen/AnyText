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

The development sequence is documented in:

- `docs/planning/anytext-development-sequence.md`

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
