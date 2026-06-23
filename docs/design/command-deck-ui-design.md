# AnyText Command Deck UI Design

## Design Read

Reading this as a personal developer utility for cross-device relay, with a premium devtool language, leaning toward a compact dark Command Deck interface.

Design dials:

- Design variance: 5/10. Structured and utilitarian, with enough asymmetry to feel designed.
- Motion intensity: 5/10. Responsive and tactile, not cinematic.
- Visual density: 6/10. Dense enough for repeated technical use, not a dashboard cockpit.

## Visual Direction

Command Deck is the official MVP direction.

The interface should feel like a focused tool for passing code, commands, Markdown, images, and files between personal devices. It should not feel like a marketing page, generic SaaS dashboard, chat app, or note-taking canvas.

Core visual traits:

- Dark graphite base.
- Matte panels with fine borders.
- Muted steel dividers.
- One sharp accent color, preferably acid green or electric cyan.
- Syntax highlighting can use secondary colors, but the product accent remains singular.
- Off-black rather than pure black.
- No purple AI gradients.
- No decorative blobs.
- No emoji-led UI.
- No oversized cards.

## Typography

Recommended stack:

- UI sans: Geist Sans or Satoshi.
- Code and metadata: JetBrains Mono or Geist Mono.

Typography behavior:

- Compact labels.
- High line-height for Markdown reading.
- Code blocks use mono with readable spacing.
- Metadata such as file size, expiry, and language labels use mono at small sizes.
- Do not use serif fonts.

## Layout

### Desktop

Desktop uses a two-column working surface:

- Left column: Compose, approximately 42%.
- Right column: Queue, approximately 58%.

The layout is full-height, with a restrained top bar. The app should open directly into the working surface, not a landing page.

Top bar:

- App name: `AnyText`.
- Room/device status.
- Compact room menu trigger.
- Optional refresh/sync indicator.

Left column:

- Compose panel.
- Markdown editor.
- Attachment drop zone.
- Attachment list.
- Send area.

Right column:

- Queue header.
- List of temporary relay items.
- Expanded detail view for selected item.

### Tablet

Tablet can keep two columns if width allows. If cramped, it should switch to stacked sections:

- Compose first.
- Queue second.
- Detail opens inline under selected queue item.

### Mobile

Mobile uses a two-tab layout:

- `Send`
- `Queue`

The default tab after sending should switch or hint toward `Queue`, but should not feel jumpy.

Mobile detail view:

- Opens as a full-screen sheet.
- Markdown and code blocks must remain readable.
- Code block copy buttons must be thumb-accessible.

## Compose UI

Composer contains:

- Section label: `Compose`.
- Markdown textarea.
- File drop/select area.
- Attachment chips/list.
- Size and limit feedback.
- Primary `Send` button.

Markdown textarea:

- Large enough for a meaningful ChatGPT answer.
- Uses mono only when content is code-heavy? Preferred: UI sans for normal Markdown input, mono inside preview/code blocks.
- Placeholder should be direct, for example: `Paste Markdown, code, commands...`.

File drop zone:

- Compact and precise.
- Supports drag-and-drop on desktop.
- Supports click-to-select everywhere.
- Shows accepted action without becoming a large empty card.

Attachment list:

- Each attachment row/chip shows file name, size, type, and remove icon/button.
- Image attachments can show a tiny thumbnail.
- Over-limit states should be inline, not modal.

Send area:

- `Send` is the only primary CTA on the working surface.
- Button has high contrast.
- Button label must not wrap.
- Disabled state must explain why if limits are exceeded.

## Queue UI

Queue contains:

- Header: `Queue`.
- Compact item list.
- Empty state.
- Loading state.
- Error state.

Queue item collapsed state:

- Sender device.
- Created time.
- Time remaining, for example `1h left`.
- Markdown excerpt.
- Attachment count.
- Optional type indicators for image/file.
- Delete action can be secondary or revealed on hover/focus.

Queue item expanded state:

- Raw content actions: `Copy Markdown`, `Delete`.
- Markdown preview.
- Code blocks with individual copy controls.
- Image attachment preview.
- File attachment download rows.

The newest item appears at the top.

## Markdown Preview

Markdown preview is central to the product and should not look like generic browser Markdown.

Required styling:

- Clear heading hierarchy.
- Comfortable body width.
- Readable lists and blockquotes.
- Links are visible but not loud.
- Inline code has subtle contrast.
- Tables are horizontally scrollable on small screens.

Code blocks:

- Dark block inside dark interface still needs contrast.
- Language label at top.
- Individual `Copy` button.
- Shell/command blocks receive stronger treatment, such as a terminal-style top strip or command accent line.
- Copied state is visible without moving layout.

## Attachment Preview

Image attachments:

- Thumbnail in item detail.
- Click or tap opens larger preview.
- Larger preview should have close and download controls.

File attachments:

- File icon from the chosen icon library.
- File name.
- Size.
- MIME/type label.
- `Download` action.

No document preview in MVP.

## Pairing UI

First-run screen:

- Compact setup surface.
- Two primary choices: `Create Device Circle` and `Join Existing Circle`.
- No marketing explanation.
- No account prompts.

Create flow:

- Generate room key.
- Show QR code.
- Show copyable join link.
- Show manual pairing code.

Join flow:

- Paste or type pairing code.
- Validate and store room key.
- Land on main Command Deck.

Already paired:

- Show room status in top bar.
- Room menu includes:
  - `Copy join link`
  - `Show QR`
  - `Rename device`
  - `Reset this browser`

Do not build a full device management UI in MVP.

## States

Required states:

- First-run unpaired.
- Pairing QR visible.
- Joining existing room.
- Empty queue.
- Loading queue.
- Realtime disconnected.
- Upload in progress.
- Upload failed.
- Message created.
- Message deleted.
- Message expired.
- Attachment over limit.
- Markdown over limit.

Loading should use skeletons that match final layout, not generic spinners.

## Iconography

Use one icon family only.

Recommended:

- Phosphor Icons or Tabler Icons.

Do not hand-roll SVG icons unless no library glyph exists and the shape is trivial.

Suggested icon usage:

- Send: paper plane / arrow up.
- Copy: copy icon.
- Delete: trash icon.
- Download: download icon.
- File: file icon.
- Image: image icon.
- Room menu: dots or chevron.
- QR: QR icon.

Icon buttons must have tooltips on desktop and accessible labels everywhere.

## Color Tokens

Suggested dark tokens:

- `surface-base`: near-black graphite.
- `surface-panel`: dark graphite.
- `surface-raised`: slightly lighter graphite.
- `border-muted`: steel gray with low opacity.
- `text-primary`: near-white.
- `text-secondary`: cool gray.
- `text-muted`: muted gray.
- `accent`: acid green or electric cyan.
- `danger`: restrained red.
- `warning`: amber only for validation.

Use the accent consistently. Do not add unrelated highlight colors outside syntax highlighting and state feedback.

## Shape System

Use a consistent radius rule:

- Panels: 10px.
- Inputs and code blocks: 8px.
- Small buttons and chips: 8px.
- Pills only where the control is truly pill-shaped, such as tiny metadata badges.

Avoid very large rounded cards.

## Accessibility

Minimum requirements:

- WCAG AA contrast for text and controls.
- Visible keyboard focus states.
- Proper labels for textarea and file input.
- Buttons never rely on icon-only meaning without an accessible label.
- Delete requires a clear affordance and should not be easy to trigger accidentally on touch.
- Reduced motion support.
- Markdown preview must not execute arbitrary HTML or scripts.

## Visual Reference From Generated Concept

The selected direction is Version 1: Command Deck.

Use the generated concept as mood and layout reference only. The implementation spec above is authoritative where the generated image contains extra or inconsistent details.
