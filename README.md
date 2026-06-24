# AnyText

AnyText is a static Vite + React Command Deck for sending one-hour Markdown and attachments between browsers through Supabase.

Production URL:

https://nitcanken.github.io/AnyText/

## Local Development

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Set these frontend variables in `.env.local`:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Do not put a service role key in any `VITE_*` variable. Vite exposes `VITE_*` values to the browser.

## Quality Gates

```bash
npm run lint
npm test
npm run build
```

## Supabase Deployment

Install and authenticate the Supabase CLI, then link the project:

```bash
supabase login
supabase link --project-ref "$SUPABASE_PROJECT_REF"
supabase db push
```

Deploy Edge Functions:

```bash
supabase functions deploy anytext-create-download-url
supabase functions deploy anytext-cleanup-expired --no-verify-jwt
```

Required Function secrets:

```bash
supabase secrets set ANYTEXT_CLEANUP_TOKEN="generate-a-long-random-token"
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are expected in the Edge Function environment. Keep the service role key out of the frontend and GitHub Pages variables.

## Cleanup Schedule

The cleanup function follows the MVP cleanup order:

1. Find expired or deleted attachment records.
2. Delete matching Supabase Storage objects.
3. Delete attachment records.
4. Delete expired or deleted messages with no remaining attachments.

Run manually:

```bash
curl -X POST "$VITE_SUPABASE_URL/functions/v1/anytext-cleanup-expired" \
  -H "Authorization: Bearer $ANYTEXT_CLEANUP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit":100}'
```

For production, schedule `anytext-cleanup-expired` in Supabase to run every 5 minutes with the same bearer token.

For development expiry verification, create a room/message, then shorten `messages.expires_at` and matching `attachments.expires_at` in the Supabase SQL editor before invoking cleanup.

## GitHub Pages Deployment

The workflow at `.github/workflows/deploy-pages.yml` runs on `main` and executes lint, tests, and build before deploying `dist`.

Repository settings:

- Pages source: GitHub Actions.
- Repository variable: `VITE_SUPABASE_URL`.
- Repository secret: `VITE_SUPABASE_ANON_KEY`.

The build base path is `/AnyText/` by default and can be overridden with `VITE_BASE_PATH`.

## MVP Acceptance Checklist

- Fresh browser creates a room.
- Second browser joins by QR, join link, or manual room key.
- Room persists after refresh through `localStorage`.
- ChatGPT-style Markdown renders with GFM, sanitized HTML, syntax highlighting, raw Markdown copy, and per-code-block copy.
- Images upload, preview, and download through signed URLs.
- Documents upload and render as download rows only.
- Delete syncs through Supabase realtime.
- Items show one-hour countdown, disappear from queue after expiry, and show an expired detail state if already open.
- Scheduled cleanup removes expired or deleted Storage objects and records.
- Desktop and mobile Command Deck layouts are usable with visible focus and reduced-motion support.

## Latest Production Verification

Verified on 2026-06-25 against `https://nitcanken.github.io/AnyText/` after GitHub Pages run `28118310283` deployed commit `82ca942`.

- GitHub Pages returned the AnyText Vite app with the `/AnyText/` base path.
- Production E2E covered fresh room creation, second isolated browser joining by link, refresh persistence, Markdown render/sanitization, image/PDF attachments, image preview modal, signed document download, receiver delete syncing back to sender, 390px mobile Queue tab layout, and reduced-motion media emulation.
- In-app Browser clipboard verification confirmed exact raw Markdown copy and exact bash code block copy.
