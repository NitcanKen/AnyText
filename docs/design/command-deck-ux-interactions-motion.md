# AnyText Command Deck UX, Interactions, and Motion

## Interaction Principles

AnyText should feel fast, light, and exact.

The UX should optimize for:

- Paste.
- Attach.
- Send.
- Open on another device.
- Copy or download.
- Delete when done.

The app should avoid heavy workflows, long explanations, confirmation screens, and unnecessary navigation.

Motion should communicate state changes and feedback. It should never be decorative filler.

## Core Journey

### First Device

1. User opens AnyText.
2. App detects no room key in `localStorage`.
3. User chooses `Create Device Circle`.
4. App generates room key.
5. App shows QR code, join link, and manual pairing code.
6. User can start sending immediately from this device.

### Additional Device

1. User scans QR code or opens join link.
2. App shows a lightweight join confirmation.
3. User confirms joining the device circle.
4. Room key is stored in `localStorage`.
5. User lands on the main Command Deck.

### Sending Content

1. User pastes Markdown text.
2. User optionally drags files or selects files.
3. App validates text size, attachment count, and attachment size.
4. User presses `Send`.
5. Button enters sending state.
6. Upload progress appears.
7. Composer clears after success.
8. New queue item appears at the top.

### Receiving Content

1. Paired device opens AnyText.
2. App lists unexpired queue items.
3. New realtime items appear at the top.
4. User opens an item.
5. User copies raw Markdown, copies a code block, previews image, downloads file, or deletes item.

## Button Design and Behavior

### Send Button

Default:

- High-contrast accent background.
- Clear label: `Send`.
- Optional send icon.

Hover:

- Slight lift or border highlight.
- Cursor feedback is immediate.

Active:

- Compress by 1-2px or scale to 0.98.
- No layout shift.

Sending:

- Label changes to `Sending`.
- Button becomes disabled.
- Progress rail or inline progress indicator appears.
- Do not use a generic circular spinner as the only feedback.

Success:

- Short confirmation state, for example `Sent`.
- Composer clears.
- New queue item enters.
- Button returns to `Send`.

Failure:

- Button returns to enabled state.
- Inline error near the failed area.
- Failed attachments remain selected so the user can retry or remove them.

### Copy Buttons

Copy interactions must be excellent because they are core to the product.

Default:

- Label: `Copy`.
- Icon: copy glyph.

Hover:

- Subtle border or surface shift.

Active:

- Tiny compression.

Success:

- Label changes to `Copied` for around 1.2 seconds.
- Code block border or header gives a brief accent pulse.
- No toast required for individual code copy unless the action is off-screen.

Failure:

- Label changes to `Failed`.
- Provide fallback instruction only if clipboard permission fails.

### Delete Button

Delete should be available but secondary.

Desktop:

- Visible in expanded detail.
- In collapsed queue rows, can appear on hover/focus.

Mobile:

- Visible in item detail.
- Avoid tiny destructive icons in dense rows.

Behavior:

- For MVP, deleting a message can show a lightweight confirmation only when the item has attachments.
- For text-only items, a delete with undo toast is acceptable.
- Undo window can be short, around 5 seconds, if deletion is implemented as soft delete first.

## Dropdown and Room Menu

The room menu is one of the places where the product should feel especially crafted.

Trigger:

- Compact button in top bar.
- Shows device or room status.
- Uses chevron or dots icon.

Menu items:

- `Copy join link`
- `Show QR`
- `Rename device`
- `Reset this browser`

Interaction details:

- Menu opens aligned to trigger.
- Opening animation: fade + 4px downward slide, 120-160ms.
- Closing animation: fade out, 90-120ms.
- Keyboard navigation with arrow keys.
- Escape closes.
- Click outside closes.
- Focus returns to trigger after close.
- Each item has icon, label, and optional helper text only where useful.
- Destructive `Reset this browser` is visually separated.

Hover state:

- Surface highlight.
- No colored status dots.
- No excessive glow.

Reduced motion:

- Menu appears instantly or with opacity only.

## Attachment Interactions

### Drag Over

When files enter the compose area:

- Drop zone border shifts to accent.
- Background gets a restrained tint.
- Text changes to a direct drop prompt.
- No large overlay that hides the whole app unless files are dragged over the window.

### File Added

On add:

- Attachment chip/row appears with a small slide/fade.
- File validation happens immediately.
- Invalid files show inline reason.

### Remove Attachment

On remove:

- Row fades and collapses.
- The list height transition should be short and stable.

### Upload Progress

During send:

- Each attachment row can show a thin progress rail.
- Overall composer can show a sending state.
- If one file fails, show which file failed.

## Queue Interactions

### New Item Arrival

When a new item arrives:

- Item appears at top.
- Use fade + slight vertical slide.
- If the user is reading an expanded item, do not steal focus.
- Optionally show a subtle `New` marker until viewed.

### Item Expand

Clicking a queue item expands it inline on desktop.

Animation:

- Height expands with content measured by layout animation.
- Opacity fades in for detail content.
- Duration around 180-240ms.
- Use reduced motion fallback.

Mobile:

- Opens as full-screen or near-full-screen detail sheet.
- Sheet slides up or in from right depending on route structure.
- Back/close is always clear.

### Item Expiry

Expiry should be visible but not stressful.

Display:

- `1h left`, `42m left`, `5m left`.
- Optional thin remaining-time hairline.

When expired:

- Item fades out only if it is not currently open.
- If open, show an expired state and prevent new downloads if the signed URLs are gone.

## Markdown and Code Interactions

### Markdown Preview

Preview should preserve reading flow.

Interactions:

- Links open in a new tab.
- Tables scroll horizontally on small screens.
- Long code blocks have internal horizontal scroll.
- Copying raw Markdown does not alter formatting.

### Code Block

Each code block has:

- Language label.
- Copy button.
- Optional shell styling for command blocks.

Shell command styling:

- Slightly stronger header.
- Optional prompt marker, but it should not get copied unless it is part of the original text.
- No execute button in MVP.

Copy behavior:

- Copy exactly the code content.
- Preserve line breaks.
- Do not include UI labels or line numbers unless line numbers are explicitly part of the content.

## Image Preview Interaction

Thumbnail click:

- Opens larger preview.
- Background overlay should be dark and calm.
- Close with Escape, outside click, or close button.
- Download action visible.

Animation:

- Thumbnail to preview can use a simple scale/fade.
- Avoid complex photo-gallery behavior.

Mobile:

- Large preview should fit viewport.
- Pinch zoom is optional, not MVP.

## Error Handling UX

Validation errors:

- Shown before sending.
- Located near the relevant field or attachment.
- Plain language.

Examples:

- `Markdown is over 500KB.`
- `Maximum 10 attachments.`
- `This file is over 25MB.`
- `Upload failed. Retry or remove this file.`

Network errors:

- Keep unsent content in composer.
- Show retry.
- Do not clear content until message creation succeeds.

Realtime disconnected:

- Show a small sync warning in queue header.
- Provide `Refresh`.
- Do not block normal reading of existing items.

## Empty, Loading, and Success States

Empty queue:

- Short and functional.
- Example: `No items in the last hour.`
- Avoid long onboarding text.

Loading:

- Skeleton rows matching queue item shape.
- No generic spinner in the middle of the app unless loading takes unexpectedly long.

Success:

- Prefer local, contextual feedback over global toast spam.
- Sending success is shown through button state and queue insertion.
- Copy success is shown near the copied control.

## Keyboard Interaction

MVP should support basic keyboard efficiency:

- `Cmd/Ctrl + Enter`: send when composer is focused.
- `Esc`: close menu, image preview, or detail sheet.
- `Tab`: reaches all controls in logical order.
- `Enter` / `Space`: activate buttons.

Nice-to-have after MVP:

- Arrow keys through queue.
- `C` to copy selected Markdown.
- `/` to focus queue filter if search is later added.

## Motion System

Use motion sparingly and consistently.

Default easing:

- Fast UI feedback: 100-160ms.
- Expand/collapse: 180-240ms.
- Page/sheet transitions: 220-280ms.

Allowed animated properties:

- Opacity.
- Transform.

Avoid animating:

- Width.
- Height directly without a layout animation helper.
- Top/left.
- Box shadow as a primary animation.

Reduced motion:

- Disable slide/scale transitions.
- Keep instant state changes or opacity-only changes.

## Interaction Priorities

The highest-craft moments are:

1. Send button.
2. Code block copy.
3. Room dropdown.
4. Pairing QR/link flow.
5. Queue item expansion.
6. Attachment add/upload states.

These moments should receive the most design and QA attention.

## Anti-Patterns

Do not ship:

- Heavy onboarding.
- Repeated QR scans for every transfer.
- Auto-clearing failed content.
- Copy buttons that move layout when state changes.
- Tiny destructive controls on mobile rows.
- Decorative animations without state meaning.
- Toast spam for every minor action.
- Generic modal for every detail view.
- Marketing hero before the tool.
- A dashboard-looking table as the main queue.
