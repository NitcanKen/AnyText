# AnyText UX Polish Scope

Status: proposed scope for the next UX polish pass  
Date: 2026-06-25  
Owner: Command Deck product/design implementation

## Purpose

This scope captures small but high-impact UX improvements for AnyText after the MVP relay loop is working. The product should feel like a precise cross-device relay, not a chat app, file manager, or upload dashboard.

The main problem to fix is state ambiguity. If the UI says or implies that an upload is happening before the user presses `Send`, users will assume the app is stuck. If the receiver shows `0 attachments` while the sender is still uploading, users will assume data was lost. Both states are technically explainable, but product-wise they are misleading.

## UX Principles

- Every visible state must map to a real system state.
- Draft content stays local until the user explicitly sends it.
- Receiver queue items should represent published relay items, not backend assembly steps.
- Progress bars should only animate for actual transfer or write work.
- Status copy should be short, factual, and action-oriented.
- Motion should clarify what changed; it should not decorate idle states.

## Taste Bar

Design read: developer-first product UI for a compact relay tool, with a dark command-deck language, dense-but-calm information design, one electric accent, and restrained stateful motion.

Taste dials:

- Design variance: 4/10. This is a tool, not a landing page. Use quiet asymmetry only where it improves scanning.
- Motion intensity: 4/10. Motion should make cause and effect visible. No ornamental loops.
- Visual density: 7/10. The app should feel efficient and command-like, but not cramped.

### Visual Standards

- Use one accent family only: the existing AnyText electric green should carry ready/success/active states.
- Avoid adding extra blue, purple, orange, or rainbow status colors unless they communicate error or warning.
- Keep the row system disciplined: same row height rhythm, same icon box size, same progress rail thickness.
- A selected queue item should look selected through border, background, and subtle accent hairline, not by becoming visually heavy.
- Empty and pending states should be quiet. They should explain state without looking like alerts.
- Buttons must align on the same visual baseline across upload and receive areas.
- Do not use generic circular spinners as the primary signal. Use rails, skeletons, or label changes that match the final shape.
- Do not use large card-within-card nesting. The command deck already has panels; rows should feel embedded in the deck.

### Motion Standards

- Motion must be causally tied to an action: select file, send, publish, receive, copy, delete, expire.
- Timing should stay mostly between 120ms and 240ms.
- Use easing that feels mechanical and crisp, not bouncy.
- Hover effects should be subtle: border shift, surface lift, or 1px translate.
- Active press should feel tactile: 1-2px compression or scale around 0.98.
- Progress movement should never imply background work that is not happening.
- Reduced motion must preserve state clarity through text, opacity, and layout, not hidden animation assumptions.

### What Would Fail The Taste Bar

- A ready attachment row with a half-filled progress bar.
- A receiver row that briefly says `0 attachments` for an item that is still being assembled.
- A Send button that changes label but gives no indication which phase is happening.
- A pending row that looks identical to a real published item.
- Multiple status colors competing with the green command-deck accent.
- Layout shift when upload progress appears.
- A loading spinner beside every small operation.
- Toast spam for actions that already have local button feedback.

## P0: Attachment Draft vs Upload State

### Current Problem

After selecting an attachment, the attachment row shows a partially filled progress rail even though the file has not started uploading. In screenshots this looks like the upload is stuck or very slow. The real upload only begins after pressing `Send`.

### Required Behavior

Before `Send`:

- Attachment rows are in `ready` state.
- No progress bar is shown.
- Row shows filename, size, type, and a compact `Ready` label.
- `Ready` should be a text status in the metadata line, not a badge that competes with the filename.
- The remove button remains enabled.
- The Send button label can include count context, for example `Send` or `Send 1 file`.
- The row should reserve vertical space for the later progress rail so the layout does not jump after Send.

After pressing `Send`:

- Attachment rows become locked.
- A progress rail appears from 0%.
- Row label changes to `Uploading`.
- The remove button is disabled or hidden while the file is in-flight.
- Overall composer status appears only during real work, for example `Uploading 1 file` or `Publishing relay item`.

On success:

- The row reaches 100%.
- The Send button briefly becomes `Sent`.
- Composer clears.
- The local queue receives the published item with a short arrival animation.
- The success state should feel like a completed command, not a celebration.

On failure:

- Failed file remains in the composer.
- Row label changes to `Failed`.
- Progress rail uses error color or stops at the failed point.
- User can remove or retry.
- Other successful files should not be hidden behind a generic error.

### Motion

- Ready row enter: fade + 4px upward settle, 140-180ms.
- Send press: button compresses by 1-2px, then enters sending state.
- Progress rail: linear width transition, no fake idle animation.
- Success: brief accent hairline sweep across the row, then composer clears.
- Failure: restrained border pulse once, no shaking.
- Reduced motion: opacity-only changes, no slide or sweep.

## P0: Receiver Should Not Show `0 Attachments` During Upload

### Current Problem

The receiver can show a new queue item with `0 attachments` before the sender finishes uploading. Once upload completes, it updates to `1 attachment`. This is technically a transient backend state, but to the receiver it looks like a broken item.

### Preferred Product Behavior

Use an atomic publish model:

1. Sender creates or reserves a backend draft that is not visible in receiver list queries.
2. Sender uploads files and writes attachment metadata.
3. Sender finalizes the message as `published`.
4. Receiver only receives or lists `published` items.

Receiver should never show a normal item as `0 attachments` if the sender intended to send attachments.

### Acceptable Fallback If Atomic Publish Is Not Immediately Feasible

If realtime currently exposes a message before attachment metadata is ready, the receiver must show a distinct pending state instead of a normal queue row:

- Title: `Receiving item`
- Metadata: `Preparing attachments`
- Attachment count badge: hidden, not `0`
- Detail panel: skeleton rows with `Receiving...`
- Actions disabled until published.
- If publish does not complete within a short timeout, show `Still receiving` and offer `Refresh`.

This fallback is less clean than atomic publish, but it avoids the misleading `0 attachments` state.

### Motion

- Pending receiver item appears as a muted skeleton row, not selected by default.
- When published, it morphs into the real queue row with a subtle height/content crossfade.
- If the user is reading another item, do not steal focus.
- If the pending item fails, collapse into a small error row with `Could not receive item`.
- The pending row must be visually lighter than a real item: lower contrast text, no active accent border, and no attachment count.

## P1: Clearer Send Lifecycle

### Required Lifecycle

The composer should have these explicit states:

| State | Meaning | UI |
| --- | --- | --- |
| `draft_empty` | Nothing to send | Empty textarea and attach prompt |
| `draft_ready` | Text and/or files selected locally | Send enabled, no upload progress |
| `validating` | Client checks limits and file metadata | Very short inline status only if visible |
| `uploading` | Files are being sent to storage | Per-file progress rails |
| `publishing` | Metadata is being written/finalized | Overall thin progress or indeterminate rail |
| `sent` | Published successfully | Brief success state, composer clears |
| `failed` | Send did not complete | Inline error, retry/remove affordance |

### Copy Guidelines

- Use `Ready` before Send.
- Use `Uploading` only after bytes are moving.
- Use `Publishing` or `Writing to relay` only while backend metadata is being finalized.
- Avoid `Queued` unless there is an actual queue.
- Avoid showing percentages for work that cannot be measured.

## P1: Upload And Publish Progress Model

### Per-File Progress

- Show only during actual upload.
- Use real upload progress when available.
- If the browser/client cannot provide exact upload progress, use an indeterminate rail with copy that says `Uploading`, not a fake percent.

### Overall Progress

- Overall progress should aggregate real file upload progress and publish work.
- If publish has no measurable progress, reserve the final 5-10% for `Publishing`.
- Do not leave the UI at 80% if the app is waiting for user action.

### Button State

- Default: `Send`
- With attachments: `Send 1 file` / `Send 3 files` is acceptable if space allows.
- During upload: `Sending`
- During publish: `Publishing`
- Success: `Sent`
- Failure: `Retry send`
- Button width should stay stable across these labels to avoid jitter.

## P1: Queue Row Information Quality

Queue rows should make the content understandable without opening every item.

For text:

- First meaningful line or first heading.
- Fallback: `Markdown note`.

For attachments:

- `1 image`, `2 files`, `1 image + 1 file`.
- Do not show `0 attachments` for pending or draft states.

For mixed content:

- Prefer content summary plus attachment count.
- Example: `Install notes` with `1 file`.

Visual standard:

- Queue rows should be scannable in under one second.
- Primary text gets one line.
- Metadata gets one line.
- Count badge is fixed-width and aligned.
- Destructive delete controls should not dominate the row.

## P1: Copy Feedback

Copy is a core AnyText action, so feedback should be specific.

- Raw Markdown button: `Copy Markdown` -> `Markdown copied`.
- Code block copy: `Copy` -> `Code copied`.
- Shell command block: `Copy command` -> `Command copied`.
- Attachment download button should not say copied.
- Feedback should last around 1.2 seconds.
- Avoid global toasts unless the action result is off-screen.

## P1: Pairing Code Readability

The shortened room key is easier than a long string, but it can still be easier to read.

Display format:

- Visual grouping: `126 393 $`
- Actual copied/joined value: `126393$`
- Use large monospace type.
- Provide one-click copy.
- Manual input should accept spaces and normalize them away.

## P2: Empty, Expired, And First-Run States

### Empty Queue

Current empty state should become more action-oriented:

- When paired: `No items in the last hour.`
- If composer has draft content: `Press Send to relay this draft.`
- If no draft content: `Paste text or attach a file to start.`

### Expired Items

- Closed expired item fades out.
- Open expired item becomes an expired detail state.
- Copy/download actions are disabled with short explanation.

### First Run

First-run should stay functional, not become a landing page:

- Create device circle is primary.
- Join existing circle is secondary.
- Pain point can be one short line only.
- Pairing QR and code should be visually prominent once a room exists.

## Implementation Notes

### Data Model Direction

Preferred backend-visible statuses:

- `draft`: reserved by sender, not visible to receivers.
- `uploading`: optional internal state, not visible as a normal item.
- `published`: visible to room list and realtime subscribers.
- `failed`: not visible to receivers; sender can retry or clean up.
- `deleted`: hidden from all normal views.

If the current schema does not support message status, the implementation can approximate this by creating the visible message only after attachments are uploaded and attachment metadata is ready.

### Realtime Direction

- Subscribe receivers to published items only.
- If attachment metadata updates separately from message insert, debounce or gate UI display until metadata is loaded.
- Queue detail should not auto-select a transient pending row.

### Accessibility

- Progress rails need accessible labels such as `Uploading Microcraft Product Introduction.pdf, 80 percent`.
- Indeterminate rails should use `aria-busy`.
- Send button disabled reason should remain available through nearby text.
- Reduced motion must remove slide/sweep animations.

## Acceptance Criteria

- Selecting files shows `Ready` state with no progress rail.
- Pressing `Send` is the first moment upload progress appears.
- No receiver sees a normal item with `0 attachments` for an attachment send.
- Receiver either sees nothing until publish, or sees a clearly distinct `Receiving item` pending state.
- Published queue row has correct attachment count on first appearance.
- Send lifecycle states are visually distinct and copy is accurate.
- Failure leaves actionable retry/remove UI.
- Desktop and mobile layouts do not shift when progress appears.
- Reduced motion mode remains clear without animation.

## Non-Goals

- No account system.
- No long-term history.
- No upload manager.
- No background clipboard watcher.
- No native share extension.
- No chat-style read receipts.
- No per-recipient delivery tracking.

## Recommended Execution Order

1. Remove ready-state progress rail and replace it with explicit `Ready` status.
2. Gate receiver visibility behind `published` state or equivalent atomic publish behavior.
3. Add sender lifecycle copy and per-file progress behavior.
4. Add receiver pending fallback only if atomic publish cannot land immediately.
5. Polish queue row summaries, copy feedback, and pairing code readability.
6. Verify desktop, mobile, keyboard navigation, and reduced motion.
