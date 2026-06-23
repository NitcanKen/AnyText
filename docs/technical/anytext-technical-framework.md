# AnyText Technical Framework

## Technical Direction

AnyText MVP is a static Web App backed by Supabase.

Recommended stack:

- Frontend: Vite + React + TypeScript.
- Styling: Tailwind CSS.
- UI state: React local state plus a small app-level store if needed.
- Backend boundary: Supabase Edge Functions and/or restricted RPC.
- Database: Supabase Postgres.
- File storage: Supabase Storage.
- Realtime: Supabase Realtime.
- Hosting: GitHub Pages for the frontend.

This stack is chosen because AnyText is a client-heavy utility. It does not need SSR, server-rendered routes, or a full app server in the MVP.

## Frontend Framework

Use Vite + React + TypeScript.

Reasons:

- Works cleanly as a static GitHub Pages deployment.
- Fast local development.
- Simple build output.
- Good fit for a single-page utility app.
- Avoids unnecessary SSR complexity.

Avoid Next.js for MVP unless a later requirement needs server-rendered routes or framework-specific deployment features.

## Styling and Component Strategy

Use Tailwind CSS for styling.

Preferred approach:

- Build a small local component system.
- Do not import a large design system.
- Keep components app-specific and tightly aligned with Command Deck.

Core local components:

- `AppShell`
- `TopBar`
- `RoomMenu`
- `Composer`
- `MarkdownEditor`
- `AttachmentDropzone`
- `AttachmentList`
- `SendButton`
- `QueuePanel`
- `QueueItem`
- `MessageDetail`
- `MarkdownPreview`
- `CodeBlock`
- `ImagePreviewModal`
- `FileDownloadRow`
- `Toast`
- `ConfirmDialog` or `UndoToast`

Icon library:

- Use one icon family only.
- Recommended: Tabler Icons or Phosphor Icons.

Animation:

- Use CSS transitions for simple hover, active, fade, and slide states.
- Use Motion only if layout animation quality requires it.
- Do not add GSAP for MVP.

## Markdown Rendering

Markdown rendering is a core feature.

Recommended library family:

- Markdown parser / renderer: `react-markdown`.
- GitHub-flavored Markdown support: `remark-gfm`.
- Sanitization: `rehype-sanitize`.
- Syntax highlighting: `shiki` or `prism-react-renderer`.

Important rules:

- Sanitize rendered Markdown.
- Do not allow arbitrary script execution.
- Code block copy must copy exact code text.
- Shell/command blocks receive special styling only. They must not execute.

## Supabase Data Boundary

The frontend should not have broad direct access to tables.

Recommended MVP boundary:

- Public frontend uses Supabase anon key.
- Writes and sensitive reads go through Edge Functions or restricted RPC.
- Functions validate room membership by requiring room key or a derived proof from the client.

Core API surface:

- `createRoom`
- `joinRoom` or client-only join validation
- `createMessage`
- `listMessages`
- `deleteMessage`
- `createUploadUrl`
- `createDownloadUrl`
- `cleanupExpired`

If using RPC rather than Edge Functions, the RPC functions must:

- Accept only required fields.
- Validate size limits.
- Restrict queries to a single `room_id`.
- Never expose raw room keys.

## Room Identity

Room key:

- Generated client-side with Web Crypto.
- High entropy, at least 128-bit random.
- Stored in browser `localStorage`.
- Encoded into pairing QR/link.

Room ID:

- `roomId = sha256(roomKey)`.
- Stored in database.
- Used in Storage paths and queries.

Device name:

- Stored locally.
- Sent as `sender_device_name` when creating a message.
- No formal `devices` table in MVP.

## Data Model

### `rooms`

- `id`: text primary key, derived from `sha256(roomKey)`.
- `created_at`: timestamp.
- `last_seen_at`: timestamp.
- `expires_policy_minutes`: integer, default 60.

### `messages`

- `id`: UUID primary key.
- `room_id`: text.
- `kind`: text, MVP fixed as `bundle`.
- `markdown_text`: text nullable.
- `text_size`: integer.
- `sender_device_name`: text nullable.
- `created_at`: timestamp.
- `expires_at`: timestamp.
- `deleted_at`: timestamp nullable.

### `attachments`

- `id`: UUID primary key.
- `message_id`: UUID.
- `room_id`: text.
- `file_name`: text.
- `file_type`: text.
- `mime_type`: text.
- `file_size`: integer.
- `storage_path`: text.
- `preview_kind`: text, either `image` or `download`.
- `created_at`: timestamp.
- `expires_at`: timestamp.
- `deleted_at`: timestamp nullable.

## Storage Strategy

Use Supabase Storage for attachments.

Recommended path format:

```text
rooms/{roomId}/messages/{messageId}/{attachmentId}-{safeFileName}
```

Rules:

- Never trust original file names as paths.
- Preserve original file name only in metadata.
- Validate file size before upload.
- Validate attachment count before message creation.
- Treat MIME type as user-controlled and validate conservatively.

Download URLs:

- Prefer signed URLs with short expiry.
- Generate on demand for the current room and message.
- Do not expose broad bucket listing.

Image previews:

- Use signed URL.
- Render only common image types.
- Other file types download only.

## Realtime Strategy

Use Supabase Realtime for room queue updates.

Subscriptions:

- Subscribe to `messages` changes for current `room_id`.
- Subscribe to `attachments` changes only if needed, or fetch attachments after message event.

Behavior:

- On app load, fetch current unexpired messages.
- Then attach realtime subscription.
- If realtime disconnects, show a small sync warning and allow manual refresh.
- Do not make realtime required for basic operation.

## Expiry and Cleanup

Functional expiry:

- Queries only return `expires_at > now()` and `deleted_at is null`.
- Expired items disappear from normal queue.

Physical cleanup:

- Scheduled cleanup removes old database rows and Storage objects.
- Cleanup may run later than exact expiry. User-facing behavior still respects `expires_at`.

Recommended cleanup order:

1. Find expired or deleted attachments.
2. Delete Storage objects.
3. Delete attachment records.
4. Delete expired or deleted messages.
5. Optionally remove stale rooms with no active messages.

## Security Model

MVP is lightweight secure relay, not end-to-end encrypted storage.

Controls:

- High-entropy room key.
- Raw room key not stored in database.
- 1-hour expiry.
- Manual delete.
- Restricted API boundary.
- Signed attachment URLs.
- Sanitized Markdown.
- Validation of size and file count limits.

Known limitations:

- Supabase project administrators can access stored text and files.
- Anyone with the room key can join the device circle.
- If a browser profile is compromised, the room key can be read from `localStorage`.
- Pairing links should be treated as secret.

Product should communicate:

- AnyText is for temporary transfer.
- Do not send passwords, private keys, or long-term sensitive material.

## Deployment

Frontend:

- Build static assets.
- Deploy to GitHub Pages.
- Use environment variables for Supabase URL and anon key at build time.

Supabase:

- Migrations define tables, indexes, RLS policies, storage bucket, and functions.
- Edge Functions or RPC functions are deployed through Supabase tooling.
- Separate local/dev and production Supabase projects are recommended once implementation starts.

## Testing Strategy

Unit tests:

- Room key generation and room ID hashing.
- Size validation.
- Attachment classification.
- Markdown sanitization helpers.
- Time remaining / expiry helpers.

Component tests:

- Composer validation states.
- Attachment list add/remove.
- Queue rendering.
- Code block copy state.
- Room menu keyboard behavior.

Integration tests:

- Create room.
- Join room.
- Send text-only message.
- Send message with image.
- Send message with file.
- Delete message.
- Expired messages do not appear.

Browser tests:

- Desktop Command Deck layout.
- Mobile send and queue tabs.
- Drag-and-drop attachment path.
- Keyboard navigation.
- Reduced motion behavior.

Manual verification:

- Open app in two browsers or devices.
- Pair once.
- Send Markdown with code.
- Confirm realtime appearance.
- Copy code block.
- Send image and preview.
- Send document and download.
- Delete from receiving device.

## Future Upgrade Paths

Possible later upgrades:

- End-to-end encryption.
- Native macOS menu bar app.
- iOS share extension.
- Browser extension.
- Clipboard watcher.
- Search within 1-hour queue.
- Longer custom expiry.
- Per-device targeting.
- Device management.

These should not shape MVP architecture beyond leaving clean boundaries.
