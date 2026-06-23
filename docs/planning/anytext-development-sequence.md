# AnyText Development Sequence

## Development Goal

Build the smallest complete version of AnyText that proves the core relay loop:

> Pair once, send Markdown and attachments manually, receive on another device, copy or download, delete or expire.

The build should follow the Command Deck UI direction and avoid expanding into notes, chat, collaboration, or file management.

## Phase 0: Project Foundation

Objective:

- Create the frontend project and baseline quality gates.

Work:

- Initialize Vite + React + TypeScript.
- Configure Tailwind CSS.
- Add linting and formatting.
- Add test framework.
- Add basic routing or state-based screens.
- Add environment variable structure for Supabase.
- Add GitHub Pages build configuration.

Deliverables:

- App boots locally.
- Static build succeeds.
- Empty Command Deck shell renders.

Verification:

- `npm run build`
- `npm test` or equivalent initial test command

Exit criteria:

- No Supabase dependency is needed to view the static shell.

## Phase 1: Command Deck Static UI

Objective:

- Build the app interface without backend wiring.

Work:

- Top bar.
- Room status placeholder.
- Compose panel.
- Markdown textarea.
- Attachment drop/select UI.
- Attachment list.
- Send button states.
- Queue panel with mocked items.
- Message detail.
- Markdown preview.
- Code block component with mocked copy state.
- Image preview modal.
- File download row.
- Empty, loading, and error states.
- Mobile `Send` / `Queue` tab layout.

Deliverables:

- Command Deck looks and behaves like the selected UI spec using mock data.

Verification:

- Desktop visual check.
- Mobile visual check.
- Keyboard tab order check.
- Reduced motion check.

Exit criteria:

- The app feels like the selected Version 1 direction before backend work begins.

## Phase 2: Local Data Model and Validation

Objective:

- Implement client-side models and validation before touching Supabase.

Work:

- Define TypeScript types for room, message, attachment, and upload state.
- Implement room key generation.
- Implement `sha256(roomKey)` room ID helper.
- Implement Markdown size validation.
- Implement attachment count and file size validation.
- Implement file preview classification.
- Implement expiry/time remaining helpers.
- Implement local mock queue store.

Deliverables:

- UI uses real local types and validation.
- Mock queue can add, expand, delete, and expire items locally.

Verification:

- Unit tests for validators and helpers.
- Component tests for composer validation states.

Exit criteria:

- Sending a local mock item exercises the full UI path.

## Phase 3: Supabase Schema and Backend Boundary

Objective:

- Create the backend shape without yet polishing realtime or full attachment flow.

Work:

- Create Supabase project.
- Define migrations for `rooms`, `messages`, and `attachments`.
- Define storage bucket.
- Define RLS policies.
- Implement restricted RPC or Edge Function boundary.
- Implement `createMessage`.
- Implement `listMessages`.
- Implement `deleteMessage`.
- Implement basic cleanup function.

Deliverables:

- Frontend can list, create, and delete text-only messages through the chosen backend boundary.

Verification:

- Integration test or manual API test for create/list/delete.
- Confirm direct broad table access is not available from frontend assumptions.

Exit criteria:

- Text-only queue works through Supabase.

## Phase 4: Pairing Flow

Objective:

- Make device circle creation and joining real.

Work:

- First-run screen.
- Create device circle.
- Store room key in `localStorage`.
- Generate QR code and join link.
- Join existing room from link or manual code.
- Reset this browser.
- Room menu actions:
  - Copy join link.
  - Show QR.
  - Rename device.
  - Reset this browser.

Deliverables:

- Two browsers can join the same room without login.

Verification:

- Create room in one browser.
- Join from second browser.
- Refresh both browsers and confirm room persists.
- Reset one browser and confirm it leaves.

Exit criteria:

- Pairing once is enough for future sends.

## Phase 5: Realtime Text Relay

Objective:

- Complete the core text relay loop.

Work:

- Subscribe to room message changes.
- Fetch initial active queue.
- Handle realtime insert/update/delete.
- Add disconnected state.
- Add manual refresh.
- Add text-only send flow with server persistence.
- Add copy raw Markdown.
- Add per-code-block copy.

Deliverables:

- Markdown sent from one paired browser appears in another without manual refresh under normal conditions.

Verification:

- Send ChatGPT-style Markdown with multiple code blocks.
- Confirm Markdown preview.
- Confirm syntax highlighting.
- Confirm code block copy exactness.
- Confirm delete syncs across browsers.

Exit criteria:

- Main text use case is fully usable.

## Phase 6: Attachment Uploads and Downloads

Objective:

- Add images and files to the relay loop.

Work:

- Create upload URL flow.
- Upload attachments to Supabase Storage.
- Store attachment metadata.
- Generate signed download URLs.
- Image thumbnail/preview.
- Non-image file download rows.
- Upload progress.
- Per-file failure handling.
- Delete Storage objects when deleting message.

Deliverables:

- A message can include Markdown plus up to 10 attachments.
- Images preview.
- Other files download.

Verification:

- Send one image.
- Send one PDF or zip.
- Send Markdown plus multiple attachments.
- Confirm file size limit.
- Confirm attachment count limit.
- Confirm delete removes or hides message and cleans storage through backend flow.

Exit criteria:

- The full MVP content model works.

## Phase 7: Expiry and Cleanup

Objective:

- Make temporary behavior reliable.

Work:

- Enforce `expires_at` in all list queries.
- Update countdown UI.
- Hide expired items.
- Implement scheduled cleanup.
- Ensure signed URLs expire.
- Handle user viewing an item as it expires.

Deliverables:

- Items disappear after 1 hour in user-facing queue.
- Old rows and files are cleaned physically.

Verification:

- Test with shortened expiry in dev.
- Confirm expired item does not list.
- Confirm cleanup removes Storage objects.

Exit criteria:

- Temporary queue behavior is real, not just UI text.

## Phase 8: UX Polish and Accessibility

Objective:

- Bring the product up to the Command Deck UX spec.

Work:

- Refine send button states.
- Refine copy states.
- Refine room dropdown interactions.
- Refine queue expansion.
- Refine mobile detail sheet.
- Add tooltips and accessible labels.
- Ensure keyboard navigation.
- Ensure reduced motion.
- Ensure contrast.
- Improve empty/loading/error states.

Deliverables:

- Interaction quality matches `docs/design/command-deck-ux-interactions-motion.md`.

Verification:

- Keyboard-only walkthrough.
- Mobile walkthrough.
- Reduced motion walkthrough.
- Error state walkthrough.

Exit criteria:

- The app feels light and exact, not like a rough backend demo.

## Phase 9: Deployment and End-to-End Verification

Objective:

- Ship the MVP to GitHub Pages with Supabase production configuration.

Work:

- Configure production Supabase project.
- Configure environment variables.
- Configure GitHub Pages deployment.
- Validate production build path.
- Run full two-device test.
- Write README setup instructions.

Deliverables:

- Production URL hosted by GitHub Pages.
- Supabase backend connected.
- Setup documentation.

Verification:

- Fresh browser creates room.
- Second device joins by QR/link.
- Text relay works.
- Image relay works.
- File relay works.
- Delete works.
- Expiry works.
- Mobile layout works.

Exit criteria:

- MVP is usable for the original MacBook to second-device ChatGPT relay problem.

## Recommended Build Order Summary

1. Static app foundation.
2. Command Deck UI with mock data.
3. Local validation and queue behavior.
4. Supabase schema and text-only backend.
5. Pairing flow.
6. Realtime text relay.
7. Attachments.
8. Expiry cleanup.
9. UX polish and production deploy.

This order intentionally builds the product feel before deep backend complexity, while still proving the technical risk early enough.

## Do Not Pull Forward

Do not implement these during MVP unless the user changes scope:

- User accounts.
- E2E encryption.
- Native apps.
- Clipboard watcher.
- Share extensions.
- Browser extension.
- Long-term history.
- Search.
- Tags or folders.
- Device management.
- Per-device targeting.
- Document preview.
- Collaboration.

## Primary Risks

### Supabase Access Control

Risk:

- No-login room-key access can become too permissive if implemented with direct table access.

Mitigation:

- Use restricted RPC or Edge Functions.
- Keep room-scoped operations narrow.
- Do not expose broad list or bucket operations.

### Markdown XSS

Risk:

- Markdown content may contain HTML or script-like payloads.

Mitigation:

- Use sanitization.
- Disable unsafe HTML.
- Add tests for malicious Markdown.

### Attachment Cleanup

Risk:

- Expired files remain in Storage.

Mitigation:

- Implement cleanup as a first-class phase.
- Test with shortened expiry.

### Mobile Usability

Risk:

- Desktop Command Deck does not naturally fit iPhone.

Mitigation:

- Mobile tabs are part of Phase 1, not afterthought polish.

### Overbuilding

Risk:

- Product drifts into Notion, chat, or file manager.

Mitigation:

- Keep all implementation work tied to `docs/product/anytext-mvp-requirements.md`.
