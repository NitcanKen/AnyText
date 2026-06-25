# AnyText

[![Deploy GitHub Pages](https://github.com/NitcanKen/AnyText/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/NitcanKen/AnyText/actions/workflows/deploy-pages.yml)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF)](https://vite.dev/)
[![React](https://img.shields.io/badge/React-19-61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Temporary Markdown and file relay for your own devices.**

[Live app](https://nitcanken.github.io/AnyText/) · [繁體中文](README.zh-Hant.md)

<p align="center">
  <img src="docs/assets/anytext-hero.png" alt="AnyText hero showing a dark command deck for moving Markdown and files between devices" width="100%">
</p>

AnyText is a lightweight cross-device relay board for developers and technical users who move Markdown, code, commands, screenshots, and files between their own devices. It is built for the small daily gap between "ChatGPT gave me something useful on this device" and "I need it on that other device now."

It is not a notes app, team workspace, chat app, public file-sharing service, or long-term archive. Items are temporary, manually sent, and designed to disappear from the queue after one hour.

## Screenshots

<p align="center">
  <img src="docs/assets/anytext-desktop.png" alt="AnyText desktop Command Deck with pairing, composer, queue, and Markdown preview" width="72%">
  <img src="docs/assets/anytext-mobile.png" alt="AnyText mobile Queue tab with a relay item" width="23%">
</p>

## What It Does

<p align="center">
  <img src="docs/assets/readme-flow.svg" alt="AnyText flow: pair once, paste or drop content, send, then copy on another device" width="100%">
</p>

- Pair owned devices once with a QR link or a 7-character code such as `123456!`.
- Send Markdown with GitHub-flavored tables, blockquotes, inline code, and highlighted code blocks.
- Copy the original Markdown or copy an individual code block exactly.
- Attach up to 10 files per message, with a 25 MB limit per file.
- Preview common image files and download other files through scoped signed URLs.
- Keep a temporary room queue with realtime updates, manual delete, and one-hour expiry.
- Run as a static Vite app on GitHub Pages with Supabase for Postgres, Storage, and Realtime.

## Current Status

<p align="center">
  <img src="docs/assets/readme-status.svg" alt="AnyText MVP status board showing implemented capabilities and explicit non-goals" width="100%">
</p>

AnyText is an MVP. The core browser relay is implemented and deployed, including Markdown preview, attachments, Supabase realtime sync, signed downloads, GitHub Pages deployment, and cleanup support.

The project intentionally does not include accounts, collaboration, full-text search, tags, clipboard watching, native apps, browser extensions, public sharing links, or end-to-end encryption.

## Architecture

<p align="center">
  <img src="docs/assets/readme-architecture.svg" alt="AnyText architecture: static browser app, restricted Supabase RPC, private Storage, Realtime, and GitHub Pages" width="100%">
</p>

```text
Browser app
  Vite + React + TypeScript + Tailwind
  Markdown preview, queue UI, local room persistence

Supabase
  Postgres metadata: rooms, messages, attachments
  Restricted RPC boundary for room/message operations
  Private Storage bucket for attachments
  Edge Function for scoped signed download URLs
  Edge Function for expired/deleted object cleanup
  Realtime broadcasts for queue updates

Hosting
  GitHub Pages static deployment
```

Room records use `sha256(roomKey)` as the backend room id. The raw room key is stored only in paired browsers and pairing links/QR codes.

## Security Model

<p align="center">
  <img src="docs/assets/readme-security.svg" alt="AnyText security boundary: short room secret, sha256 backend id, and explicit limitations" width="100%">
</p>

AnyText uses a lightweight shared-secret room model, not an account system.

- New rooms use a short manual pairing code: six digits plus one symbol from `!@#$%^&*`.
- The short code is a deliberate usability tradeoff for fast device pairing.
- The app is not end-to-end encrypted.
- Supabase project administrators can access stored message text and files.
- Do not use AnyText for passwords, private keys, legal/medical secrets, or long-term sensitive storage.
- Message rows and attachments are designed around one-hour expiry and manual deletion.

## Tech Stack

<p align="center">
  <img src="docs/assets/readme-stack.svg" alt="AnyText tech stack: Vite, React, TypeScript, Tailwind, Markdown libraries, Supabase, Vitest, and ESLint" width="100%">
</p>

- Vite
- React
- TypeScript
- Tailwind CSS
- Supabase JS
- Supabase Postgres, Storage, Realtime, Edge Functions
- react-markdown, remark-gfm, rehype-sanitize
- prism-react-renderer
- qrcode.react
- Tabler Icons
- Vitest and Testing Library

## Quick Start

<p align="center">
  <img src="docs/assets/readme-quick-start.svg" alt="AnyText quick start commands: clone, install, run dev server" width="100%">
</p>

Prerequisites:

- Node.js 24 recommended
- npm
- Supabase CLI if you want to run or deploy the backend

```bash
git clone https://github.com/NitcanKen/AnyText.git
cd AnyText
npm ci
cp .env.example .env.local
npm run dev
```

Set these frontend variables in `.env.local`:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

Never put a service role key in any `VITE_*` variable. Vite exposes `VITE_*` values to the browser.

## Supabase Setup

<p align="center">
  <img src="docs/assets/readme-supabase.svg" alt="Supabase setup flow: link project, push database, deploy functions, set secrets" width="100%">
</p>

Install and authenticate the Supabase CLI, then link your project:

```bash
supabase login
supabase link --project-ref "$SUPABASE_PROJECT_REF"
supabase db push
```

Deploy the Edge Functions:

```bash
supabase functions deploy anytext-create-download-url
supabase functions deploy anytext-cleanup-expired --no-verify-jwt
```

Set the cleanup invocation token:

```bash
supabase secrets set ANYTEXT_CLEANUP_TOKEN="generate-a-long-random-token"
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are expected in the Edge Function environment. Keep the service role key out of frontend variables, GitHub Pages variables, and committed files.

### Cleanup Schedule

<p align="center">
  <img src="docs/assets/readme-cleanup.svg" alt="Cleanup schedule flow: find expired records, remove Storage objects, delete metadata, finalize empty messages" width="100%">
</p>

The cleanup function:

1. Finds expired or deleted attachment records.
2. Deletes matching Supabase Storage objects.
3. Deletes attachment records.
4. Deletes expired or deleted messages with no remaining attachments.

Manual invocation:

```bash
curl -X POST "$VITE_SUPABASE_URL/functions/v1/anytext-cleanup-expired" \
  -H "Authorization: Bearer $ANYTEXT_CLEANUP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit":100}'
```

For production, schedule `anytext-cleanup-expired` in Supabase to run every 5 minutes with the same bearer token.

## GitHub Pages Deployment

<p align="center">
  <img src="docs/assets/readme-pages.svg" alt="GitHub Pages deployment pipeline: push main, install, lint, test, build, deploy" width="100%">
</p>

The workflow at `.github/workflows/deploy-pages.yml` runs on `main` and executes:

```bash
npm ci
npm run lint
npm test
npm run build
```

Repository settings:

- Pages source: GitHub Actions
- Repository variable: `VITE_SUPABASE_URL`
- Repository secret: `VITE_SUPABASE_ANON_KEY`

The default GitHub Pages base path is `/AnyText/`. Override it with `VITE_BASE_PATH` if you deploy under another path.

## Quality Gates

<p align="center">
  <img src="docs/assets/readme-quality.svg" alt="AnyText quality gates: ESLint, Vitest, production build, and smoke verification" width="100%">
</p>

```bash
npm run lint
npm test
npm run build
```

The test suite covers room helpers, pairing links, Markdown sanitization/rendering, code block copy behavior, attachment validation, Supabase relay mapping, queue expiry, and core app flows.

## Project Structure

<p align="center">
  <img src="docs/assets/readme-structure.svg" alt="AnyText project structure showing src, supabase, docs, and GitHub workflow folders" width="100%">
</p>

```text
src/
  App.tsx                    Command Deck application shell
  components/MarkdownPreview Markdown renderer and code block UI
  lib/anytext.ts             Room, validation, expiry, and attachment helpers
  lib/pairing.ts             Local pairing and join-link helpers
  lib/supabaseRelay.ts       Restricted Supabase RPC/Storage boundary

supabase/
  migrations/                Postgres schema, RPC, RLS, Storage policies
  functions/                 Edge Functions for downloads and cleanup

docs/
  product/                   Requirements and decision log
  technical/                 Technical framework and Supabase notes
  design/                    Command Deck UI and interaction direction
  assets/                    README images
```

## Contributing

Issues and pull requests are welcome. Keep changes aligned with the MVP shape:

- Single-person owned-device relay
- Temporary queue, not permanent storage
- No accounts or team collaboration
- No broad table access from the browser
- Clear validation and test coverage for user-facing behavior

Before opening a pull request, run:

```bash
npm run lint
npm test
npm run build
```

## License

<p align="center">
  <img src="docs/assets/readme-license.svg" alt="MIT license summary: use, modify, distribute, and keep the copyright notice" width="100%">
</p>

MIT. See [LICENSE](LICENSE).
