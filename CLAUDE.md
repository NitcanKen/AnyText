# AnyText

Temporary cross-device Markdown + file relay. Static Vite app (React 19 + TypeScript + Tailwind 4) backed by Supabase (Postgres RPC, private Storage, Realtime, Edge Functions), deployed to GitHub Pages. Items are temporary and expire after one hour.

## Commands
```bash
npm run dev                        # Vite dev server (host 0.0.0.0)
npm test                           # vitest run — full suite
npx vitest run src/App.test.tsx    # single test file (faster loop)
npm run build                      # tsc -b && vite build (typecheck gates the build)
npm run lint                       # eslint
```
Node.js 24 recommended.

## Structure
- `src/App.tsx` — almost the entire app UI (composer, queue, pairing, dialogs); one large file.
- `src/styles.css` — the whole design system: CSS custom properties + `@layer components`, and every keyframe/motion rule.
- `src/components/` — only `MarkdownPreview` and `CodeBlock`.
- `src/lib/` — `supabaseRelay` (restricted RPC), `supabaseClient`, `pairing`, `clipboard`, `anytext`, `cx`.
- `supabase/migrations/` — Postgres schema + RLS. `supabase/functions/` — Deno Edge Functions.
- `docs/design/` — UI/UX + motion source-of-truth specs.

## Conventions
- Put visual styling in `src/styles.css` via CSS custom properties + `@layer components`. Don't scatter Tailwind utility soup across JSX or add CSS-in-JS.
- Animate only `transform` / `opacity`, and give every animation a fallback in the existing `prefers-reduced-motion` block.
- Two accent colors only: `--accent` (lime = action / live / yours) and `--accent-cyan` (remote arrival). Never add a third accent.
- Render all user Markdown through `MarkdownPreview` (react-markdown + `rehypeSanitize`). IMPORTANT: never use `dangerouslySetInnerHTML` or disable sanitization — relay content is untrusted.

## Gotchas
- The backend room id is `sha256(roomKey)`; the raw room key lives only in the browser and in pairing links/QR. Never log it or send the raw key to the backend.
- `supabase/functions/` is Deno (different runtime) and is eslint-ignored — don't treat it as app code or import it from `src/`.
- Items are temporary (one-hour expiry), not an archive — design around disappearance, not persistence.
- Secrets live in `.env.local` (gitignored): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Never commit real values.

## Context
- Active rebuild: `docs/design/anytext-living-scene-architecture.md` is the single source of truth (Cinematic WebGL Stage — one persistent r3f scene driven by a shared store; DOM tool surfaces float inside it). Read it before any experience/motion work; track completion against its §10 checklist.
- `docs/design/anytext-tier-s-motion-scope.md` is now demoted to the **Tier‑D lite/fallback** mode + color‑discipline baseline (lime = action/yours, cyan = remote). Not the active target.
