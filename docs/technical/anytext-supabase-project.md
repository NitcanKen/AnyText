# AnyText Supabase Project Setup

## Purpose

This document records the Supabase project information needed before AnyText backend implementation starts.

It is intentionally safe to commit. Do not put Supabase service role keys, personal access tokens, dashboard session tokens, or any other secret in this file.

## Verified Project

Verified from the user's logged-in ChatGPT Atlas / Supabase dashboard window on 2026-06-24.

- Supabase organization: `NitcanKen's Org`
- Supabase project name: `AnyText`
- Supabase project ref: `cizmpumlliowigimhwqr`
- Expected project URL: `https://cizmpumlliowigimhwqr.supabase.co`
- Dashboard URL: `https://supabase.com/dashboard/project/cizmpumlliowigimhwqr`

The project URL is derived from the verified project ref and Supabase's standard project host pattern. It should still be confirmed in the Dashboard `Data API` / API settings page before production deploy.

## Values Needed Before Backend Goals

The following values are required for Goal 2 and later.

Local `.env.local` status on 2026-06-24:

- `VITE_SUPABASE_URL` is configured locally.
- `VITE_SUPABASE_ANON_KEY` / publishable key is configured locally.
- `SUPABASE_PROJECT_REF` is configured locally.
- Supabase CLI auth is configured locally through the user's interactive terminal login.
- `SUPABASE_SERVICE_ROLE_KEY` is configured locally.

```text
VITE_SUPABASE_URL=https://cizmpumlliowigimhwqr.supabase.co
VITE_SUPABASE_ANON_KEY=<copy from Supabase Dashboard Data API/API keys>
SUPABASE_PROJECT_REF=cizmpumlliowigimhwqr
SUPABASE_ACCESS_TOKEN=<local only, optional if already logged in through Supabase CLI>
SUPABASE_SERVICE_ROLE_KEY=<local only, only if backend deployment scripts need it>
```

Rules:

- `VITE_SUPABASE_URL` is safe to commit in examples.
- `SUPABASE_PROJECT_REF` is safe to commit in examples.
- `VITE_SUPABASE_ANON_KEY` / publishable anon key may be used in browser builds, but keep the real value in local or deployment environment variables rather than committed docs.
- `SUPABASE_ACCESS_TOKEN` is a secret. Keep it local only.
- `SUPABASE_SERVICE_ROLE_KEY` is a secret and must never be exposed to frontend code.

## Local Secret Handling

Create local files only after the frontend project exists:

```text
.env.local
.env.production.local
```

These files must be ignored by git.

Commit only an example file such as:

```text
.env.example
```

Example shape:

```text
VITE_SUPABASE_URL=https://cizmpumlliowigimhwqr.supabase.co
VITE_SUPABASE_ANON_KEY=replace_me
SUPABASE_PROJECT_REF=cizmpumlliowigimhwqr
```

## CLI Status

Current machine check on 2026-06-24:

- `supabase` CLI is installed through Homebrew.
- Installed CLI version: `2.107.0`.
- Browser dashboard login exists.
- CLI login is complete.
- `supabase projects list` confirms project `AnyText` is `ACTIVE_HEALTHY`.
- The project is linked: `linked: true`.

Current verification command:

```bash
supabase projects list
```

Current verified result summary:

```text
ref: cizmpumlliowigimhwqr
name: AnyText
region: us-west-2
status: ACTIVE_HEALTHY
database: Postgres 17.6.1.127
linked: true
```

Do not paste access tokens or service role keys into chat.

## Implementation Decisions For Backend Goals

Use this project as the backend target.

Backend implementation should prefer:

- Restricted Supabase Edge Functions or restricted RPC for message and attachment operations.
- Postgres tables: `rooms`, `messages`, `attachments`.
- Storage bucket for attachments.
- Signed URLs for downloads and image previews.
- Functional expiry in all list queries.
- Physical cleanup for expired/deleted storage objects.

No Supabase Auth should be added for AnyText users. The product's user authorization model remains the browser room key stored in `localStorage`. New rooms use a short manual code, and backend records still use only `sha256(roomKey)`.

## Confirm Before Production

Before the production deploy goal is marked complete, verify:

- `VITE_SUPABASE_URL` matches the Dashboard project URL.
- The anon/publishable key belongs to the `AnyText` project.
- The service role key is not present in frontend bundle, `.env.example`, committed docs, browser code, or GitHub Pages settings exposed to clients.
- Supabase Storage bucket policies do not permit broad public listing.
- RLS or function boundaries restrict all reads/writes to a single `room_id`.
