# AnyText Workspace Layout and Attachment Reachability Scope

Status: implemented on 2026-06-25
Date: 2026-06-25
Owner: Command Deck product/design implementation

## Implementation Status

Implemented on 2026-06-25:

- Replaced the fixed narrow Command Deck shell with viewport-based workspace sizing shared by the top bar and main deck.
- Split the composer into a scrollable editor region and a persistent command bar for byte status, attachment select/drop, selected attachment rows, progress, and `Send`.
- Reworked the Queue side into fixed internal regions: queue list and detail scroll independently on desktop.
- Added a message attachment dock that appears before Markdown on medium/mobile layouts and becomes a right-side rail on wide layouts when there is enough room.
- Added an attachment count jump control in the detail toolbar. It focuses the attachment dock and respects reduced motion for scroll behavior.
- Made the mobile detail view a full-screen opaque sheet with an internal scroll region, so the queue behind it does not visually interfere with the detail content.
- Updated component tests to verify the attachment dock region and count jump focus behavior.

Verification:

- `npm run lint` passed.
- `npm test` passed with 34 tests.
- `npm run build` passed with the known non-failing Tabler barrel/chunk-size warning.
- In-app Browser verification covered page identity, nonblank Command Deck rendering, clean console, long Markdown editor internal scrolling, visible command bar and Send button, and no desktop body scroll in the Browser runtime.
- Bundled Playwright verification covered `1440x900`, `1728x1117`, `2048x1152`, and `390x844`; long Markdown plus image/PDF upload; attachment dock and wide rail; mobile full-screen detail sheet; keyboard Tab order through editor, attachment controls, queue, detail actions, attachment dock controls, and Markdown; reduced-motion emulation; no horizontal overflow; and no ready-state progress bars.

Implementation deviation:

- The workspace shell cap was raised from the original suggested `1920px` to `2200px`. At `2048px` wide, a `1920px` cap leaves `64px` gutters on both sides, which contradicts the accepted goal of small safe gutters on large displays. The implemented width keeps `16px` gutters at `2048px` while still preventing unbounded growth on ultra-wide screens.

## Design Read

Reading this as a redesign of a high-frequency developer utility workspace, not a landing page. The right direction is a full-height dark command deck with stronger spatial discipline, better use of large monitors, and persistent access to send and attachment actions.

Taste dials:

- Design variance: 4/10. Keep the deck structured and predictable. Use asymmetry only to give the reading pane and attachment tray the right priority.
- Motion intensity: 4/10. Motion should explain state changes and focus movement. No decorative loops.
- Visual density: 8/10. This is a work surface. Use more of the available screen without turning it into a crowded dashboard.

## Observed Problems

### Large screens waste too much usable space

On a wide desktop monitor, the app is visually centered but the actual working surface feels narrow. The outer gutters are too large, the queue detail pane is compressed, and the user pays for a large display without receiving a larger command surface.

The current layout also keeps the queue list and detail pane inside a right-side panel that can feel like a narrow nested split. On long Markdown content, the reading pane becomes the only useful area while the remaining viewport is underused.

### Attachments are too far away when content is long

When a pasted Markdown item is long, attachments can sit after the entire preview. The user has to scroll through all text before finding the files or images. This is especially poor for AnyText because attachments are part of the relay payload, not secondary footnotes.

The same principle applies on the sending side: the editor should be allowed to scroll, but attachment controls and `Send` should remain command-level actions. A long draft must not bury the controls needed to attach or send.

### Upload and receive zones need equal visual discipline

The compose side and receive side should feel like two balanced work zones. Their headers, panel heights, command bars, and scroll boundaries should align. The UI should not look like one side is a tall form and the other side is a smaller embedded preview.

## UX Principles

- The page itself should not be the main scroll container on desktop.
- Long Markdown should scroll inside the editor or preview region only.
- Attachments must be available near the top-level message controls, not only after the Markdown body.
- Large screens should expand useful work zones, not just add empty margins.
- Reading width should stay comfortable, but extra horizontal space should become an attachment rail, queue rail, or command surface.
- Top-level send, copy, delete, download, and attachment actions should remain reachable while content scrolls.
- Motion should show that controls are docking, expanding, or receiving focus. It should not make the layout feel soft or delayed.

## P0: Full-Viewport Desktop Workspace

### Required Behavior

Desktop should use a full-height workspace below the top bar:

- The shell width should be based on viewport gutters, not a small fixed maximum.
- Recommended desktop shell: `width: min(calc(100vw - 32px), 2200px)`.
- On very wide screens, side gutters should normally stay between 16px and 24px.
- Compose and Queue panels should share the same top and bottom alignment.
- The panels should use `height: calc(100dvh - topbar - gutters)` or equivalent.
- Internal regions scroll independently through `min-height: 0` grid and flex containers.
- The body should not need vertical scrolling for normal desktop operation.

### Desktop Grid Direction

Use a responsive command deck grid:

| Viewport | Layout |
| --- | --- |
| `< 768px` | Mobile tabs: `Send` and `Queue` |
| `768px-1199px` | Two stacked or two-column layout depending on available width |
| `1200px-1535px` | Compose plus Queue, with queue list and detail split inside Queue |
| `1536px+` | Three-zone working surface: Compose, queue list, detail |

The large desktop target should feel like this:

```text
+----------------------+----------------+----------------------------------+
| Compose              | Queue list     | Detail / Markdown / Attachments  |
| editor scrolls       | item scrolls   | preview scrolls                  |
| command bar fixed    | fixed width    | actions and attachment dock fixed |
+----------------------+----------------+----------------------------------+
```

Suggested large-screen sizing:

- Compose: `clamp(500px, 34vw, 680px)`.
- Queue list: `clamp(280px, 18vw, 360px)`.
- Detail: `minmax(620px, 1fr)`.

The right detail area should receive the extra width first once the composer and queue list have reached comfortable sizes.

### Visual Standard

- Panel radii and borders stay consistent with the current Command Deck language.
- Avoid adding large nested cards. The deck itself is the container.
- Queue list selection should remain light and precise.
- The detail area should not stretch Markdown paragraphs beyond a readable width. Use the spare width for attachments or metadata.

## P0: Composer Command Bar

### Current Problem

The composer currently places editor, size metadata, drop zone, attachment list, progress, and Send in one vertical stack. This makes long content compete with file and send controls.

### Required Behavior

The composer should be split into:

1. Header: `Compose`, mode/status, compact metadata.
2. Editor region: one internal scroll area for Markdown input.
3. Composer command bar: attachment controls, selected attachment tray, validation, progress, and `Send`.

The command bar should stay visible at the bottom of the compose panel:

- Desktop: sticky or fixed inside the compose panel, never below the editor scroll.
- Mobile: sticky above the safe area inside the `Send` tab.
- The textarea/editor owns long text scrolling.
- Attachment rows should appear in a compact tray above the Send row, not push the Send button away.
- If many attachments are selected, the tray gets its own max height and internal scroll.

### Command Bar Shape

Recommended order:

1. Limit/status line: bytes used, validation state, shortcut hint.
2. Attachment drop/select strip.
3. Selected attachment tray.
4. Send progress and primary Send button.

When there are no attachments, the command bar should be compact. When attachments appear, it expands in a controlled way without moving outside the viewport.

### Motion

- Attachment tray appears with fade plus 4px upward settle, 140-180ms.
- Removing an attachment collapses the row quickly and preserves focus.
- Send button press uses 1-2px compression.
- Progress appears only during real work, following the existing upload-state scope.
- Reduced motion uses opacity-only changes and no smooth scrolling.

## P0: Detail Attachment Dock

### Current Problem

Attachments are currently rendered after Markdown. For long Markdown, this makes files hard to discover and makes the user scroll through unrelated text to reach the payload.

### Required Behavior

Message detail should expose attachments near the top of the detail controls:

- If an item has attachments, show an attachment dock immediately below the detail action row or as a right-side rail on wide screens.
- The dock should list images and files with the same metadata currently used in attachment rows.
- Image preview and file download actions should work directly from the dock.
- The bottom `Attachments` section can remain as a contextual full list only if needed, but it must not be the only access point.
- The detail header should include an attachment count control such as `2 attachments` that focuses or scrolls to the dock.

### Wide Detail Layout

On large screens, use the extra width like this:

```text
+-----------------------------------------------------+-------------------+
| Sticky detail toolbar                               | Sticky attach rail |
| Markdown reading column, max readable width          | image/file rows    |
| Long preview scrolls here                            | stays visible      |
+-----------------------------------------------------+-------------------+
```

Rules:

- Markdown reading column: around `72ch-84ch`.
- Attachment rail: `260px-340px`.
- Rail appears only when width allows it without squeezing Markdown below readable width.
- If no attachments exist, Markdown can use the center of the detail pane.

### Medium and Mobile Layout

On medium widths:

- Attachment dock appears below the detail toolbar and above Markdown.
- Dock can be horizontal scroll or a compact vertical list.
- It should remain visible in the first viewport of the detail panel.

On mobile:

- Detail sheet header stays sticky.
- Actions and attachment count are reachable before Markdown.
- Attachment dock appears before Markdown and can collapse after first interaction if space is tight.
- A sticky `Attachments` chip in the detail header can jump back to the dock.

### Motion

- Opening a detail item should reveal toolbar, attachment dock, and Markdown in sequence within 180-240ms.
- Clicking the attachment count should focus the attachment dock.
- If smooth scroll is used, keep it short and disable it under reduced motion.
- When the dock receives focus from the attachment count, use one restrained accent border pulse for 180ms.

## P1: Queue and Detail Split Quality

### Required Behavior

Queue list and detail should stop fighting for width:

- Queue list should have a stable width.
- Detail gets the remaining width.
- Queue row delete controls should not visually dominate the row.
- Empty detail state should align with the reading column, not float in an oversized empty panel.
- Long Markdown preview should scroll inside detail, with toolbar and attachment access still reachable.

### Optional Resizable Panes

Resizable desktop panes can be added after the fixed layout is corrected:

- User can resize Compose, Queue list, and Detail within min/max bounds.
- Widths are saved in localStorage per browser.
- Double-click divider resets to default.
- Dividers are keyboard accessible.
- This is P2, not required for the first layout fix.

## P1: Better Large-Screen Reading Model

Markdown body should not be stretched just because the detail pane is wider.

Required behavior:

- Keep Markdown at a comfortable measure.
- Use extra detail width for attachment rail, metadata, or empty margin that is intentionally balanced.
- Headings and code blocks should not collide with action buttons.
- Tables and code blocks keep horizontal scroll inside their own containers.
- Copy code controls stay inside code block headers and do not overlap text.

## P1: Drag and Attachment Discovery

The drop target should be available without stealing the whole screen:

- Dragging files over the compose panel highlights the command bar drop strip.
- Dragging over the whole window can show a subtle panel-level border, but should not cover the editor content with a giant overlay.
- If the user has a long draft, the drag target still appears at the visible command bar.
- On mobile, the attachment select button remains in the sticky command bar.

## Accessibility Requirements

- Keyboard tab order follows visual order: editor, command bar controls, attachment rows, Send, queue list, detail actions, attachment dock, Markdown content.
- Sticky command bars and docks must not trap focus.
- The attachment dock has a labelled region, for example `aria-label="Message attachments"`.
- Attachment count jump control uses `aria-controls` pointing to the dock.
- When jump focus moves to the dock, focus should land on the dock heading or first actionable attachment.
- Reduced motion disables smooth scroll, slide, scale, and accent sweeps.
- Screen reader labels distinguish `Attach files`, `Selected attachments`, `Message attachments`, and `Download file`.

## Implementation Notes

Recommended component direction:

- Introduce workspace-level layout classes instead of scattering viewport math through JSX.
- Split `Composer` into editor region and command bar regions.
- Extract `ComposerCommandBar` for drop/select, selected files, validation, send progress, and Send.
- Extract `AttachmentDock` so `MessageDetail` can render the same attachment data above Markdown, in a side rail, or in mobile sheet form.
- Keep existing attachment validation, upload state, and Supabase publish behavior unchanged.
- Prefer CSS Grid for the desktop shell and detail split.
- Use `min-height: 0` and explicit overflow regions on every grid/flex child that scrolls.
- Do not introduce a large design system.
- Keep Tabler as the icon family unless the whole app intentionally migrates later.

## Acceptance Criteria

- At `1440x900`, `1728x1117`, and `2048x1152`, the Command Deck uses the available screen with small safe gutters and no cramped centered work area.
- Compose and receive areas share aligned top and bottom edges on desktop.
- The browser body does not scroll during normal desktop use; editor, queue list, and detail preview scroll internally.
- With a long Markdown draft, attachment controls and Send remain visible in the composer without scrolling to the bottom of the page.
- With a long received Markdown item and attachments, attachments are reachable from the first detail viewport through a visible dock, rail, or attachment count jump control.
- The detail pane can show long Markdown and attachments without making the Markdown column too wide to read.
- On mobile `390x844`, Send and Queue tabs still work with sticky command actions and no horizontal overflow.
- Keyboard tab order reaches editor, attachment controls, Send, queue rows, detail actions, and attachment dock in a logical sequence.
- `prefers-reduced-motion: reduce` keeps all state changes understandable without slide, scale, or smooth-scroll effects.
- No new progress bars appear for idle or ready states.

## Non-Goals

- No Monaco or CodeMirror editor.
- No search or tags.
- No long-term file manager.
- No upload manager separate from Send.
- No account, collaboration, or device management expansion.
- No landing page or marketing layout.
- No new backend behavior unless required by an implementation bug found later.

## Recommended Execution Order

1. Replace the fixed narrow desktop shell with a full-viewport command deck shell.
2. Lock desktop panel heights and internal scroll boundaries.
3. Split composer into editor region plus sticky command bar.
4. Add attachment dock to message detail above Markdown.
5. Add wide-screen attachment rail when detail width allows it.
6. Tune mobile sticky command bar and mobile detail attachment access.
7. Verify desktop large-screen screenshots, mobile screenshots, keyboard order, long Markdown, long Markdown plus attachments, and reduced motion.
