# AnyText Tier‑S Motion & Craft Scope

> **Status:** Proposal / Single Source of Truth for the "world‑champion polish" pass.
> **Relationship to existing docs:** This is an **elevation layer** on top of
> [`command-deck-ui-design.md`](./command-deck-ui-design.md) and
> [`command-deck-ux-interactions-motion.md`](./command-deck-ux-interactions-motion.md).
> Those define the *baseline* Command Deck. This document defines how we push the
> baseline from "polished" (8/10) to "world‑champion / can't‑stop‑looking" (9.7/10).
> Where this doc and the baseline conflict on a Tier‑S surface, **this doc wins**.
> Everywhere else, the baseline still governs.

---

## 0. The One Sentence

> **Content in AnyText is luminous mass. It is *fired* from one device, *travels*
> through space, and *condenses* on another. Every animation serves that physics.**

If a motion idea cannot be justified as *fire → travel → condense → decay*, it does
not ship. This is the test that keeps the polish coherent instead of a pile of
unrelated effects.

The product's promise is **speed across your own devices**. So the second
non‑negotiable: **the interface must feel faster than it is, never slower.** Polish
that adds perceived latency is a regression, no matter how pretty.

---

## 1. Goals & Non‑Goals

### Goals
- Define **5 Signature Moments** that get disproportionate craft investment.
- Establish a **material & light system** (depth, grain, spotlight, color discipline)
  that reads as "expensive" without shouting.
- Codify a **motion choreography vocabulary** (named primitives + timing) so every
  new animation is consistent and reviewable.
- Keep everything **GPU‑cheap, reduced‑motion‑safe, and AA‑accessible**.

### Non‑Goals
- No new product features, data model changes, or scope creep into accounts/teams.
- No marketing hero, no onboarding tour, no toast spam (still banned per baseline
  Anti‑Patterns).
- No second accent color. `accent` (lime) and `accent-cyan` remain the only
  non‑syntax highlight colors.
- Not a rewrite. This is layered onto the existing `src/styles.css` token system.

---

## 2. Design Tokens (extends current `:root`)

Current tokens already in `src/styles.css`:

```css
--accent: #befc3c;        /* lime — energy / action / "live" */
--accent-cyan: #7dd3fc;   /* cyan — remote / arriving-from-afar */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
--ease-out-soft: cubic-bezier(0.16, 1, 0.3, 1);
```

### New tokens to introduce

```css
/* Motion durations — named, not magic numbers */
--dur-tap:        120ms;  /* button press / instant feedback        */
--dur-feedback:   180ms;  /* copy check, small state changes         */
--dur-expand:     240ms;  /* expand / collapse / detail open         */
--dur-transition: 280ms;  /* sheet / tab / page transitions          */
--dur-signature:  620ms;  /* the 5 signature moments only            */

/* Easing additions */
--ease-emphasis:  cubic-bezier(0.2, 0.8, 0.2, 1);   /* decisive, snappy in */
--ease-decay:     cubic-bezier(0.4, 0, 0.85, 0.35); /* exits / dissolve    */

/* Material / light */
--edge-light:     rgba(255, 255, 255, 0.10); /* glass top-edge highlight */
--edge-light-strong: rgba(255, 255, 255, 0.16);
--grain-opacity:  0.025;  /* 2.5% noise over flat fills, anti-banding  */
--spotlight:      rgba(190, 252, 60, 0.06);  /* cursor-follow panel glow */

/* Energy ramps (for the fire→condense beam) */
--beam-core:      #eaffb9a;  /* hot center of the send beam */
--beam-edge:      rgba(190, 252, 60, 0.0);
```

### Color discipline (hard rule)
| Color | Reserved for | Never for |
|---|---|---|
| `--accent` lime | send / action / "this is live & yours" | decoration, borders-by-default |
| `--accent-cyan` | **remote arrival** (realtime item pushed from another device) | local actions |
| `--danger` red | destructive confirm only | warnings |
| `--warning` amber | validation only | anything else |

Lime is **electricity**, not paint. The discipline *is* the luxury.

---

## 2.5 Tuned & Locked Parameters (from interactive prototype)

These were dialed in by feel in the signature-moments playground and are now
**locked** as implementation defaults.

| Parameter | Locked value | Meaning |
|---|---|---|
| **Send beam** | **Literal travelling streak** | The beam physically sweeps Composer → Queue. Not implied-only. (Resolves §11 Q1.) |
| **Signature time‑scale** | **×1.6 of base** (cinematic) | Signature moments are deliberate and weighty, not snappy. `--dur-signature` 620ms → **~1000ms effective**. |
| **Intensity** | **~50%** (moderate) | Beam clearly visible (~0.5 opacity), particles present but not dense (~0.9× count), shockwave radius mid. Confident, not gaudy. |

**Effective signature durations** (apply the ×1.6 scale to §2 base):

```css
/* Signature moments only — the cinematic tier */
--dur-signature-eff: 1000ms;  /* THE SEND total, Pairing link, Expiry decay */
/* component beats inside THE SEND, re-timed to the ~1000ms envelope: */
/*   charge   0–190ms                                                    */
/*   fire     190–520ms   (shockwave + beam streak)                      */
/*   condense 520–1000ms  (queue row materializes to catch the beam)     */
```

> **Critical scope nuance — the cinematic scale is NOT global.**
> The ×1.6 / cinematic pacing applies **only** to the 5 signature moments. The
> **feedback tier stays fast**: copy `imprint`, button `magnet`, hover, focus, and
> all everyday state changes remain at **`--dur-tap` / `--dur-feedback` (120–180ms)**,
> unscaled. Daily actions feel instant; signature moments feel cinematic. This is how
> we satisfy both "screenshot‑worthy" (§0) and "never adds perceived latency" (§7) at
> once — and the send animation is celebratory/non‑blocking, so its ~1s envelope never
> gates the actual relay.

---

## 3. The Five Signature Moments

Each moment has: **Trigger → Choreography → Timing → Reduced‑motion fallback →
Acceptance.** These six surfaces (baseline Interaction Priorities) map directly:
Send, Copy, Room dropdown, Pairing, Queue arrival, Attachments — we elevate the
first five and keep attachments at "excellent baseline."

### 3.1 ⚡ THE SEND — "Fire"
*The single most important 0.6s in the product.*

- **Trigger:** User commits a send (Cmd/Ctrl+Enter or Send button).
- **Choreography:** (beats use the locked ×1.6 cinematic envelope — see §2.5)
  1. **Charge (0–190ms):** Composer textarea content compresses — a quick
     `scale(0.97)` + brightness dip, as if inhaled toward the Send button.
  2. **Fire (190–520ms):** Send button emits a **lime shockwave ring** (expanding
     radial, fades out) + the button core flashes to `--beam-core`. A **literal
     directional beam streak** travels from Composer (left) toward the Queue
     (right) — drawing the eye along the relay axis.
  3. **Condense (520–1000ms):** A new Queue row **condenses into focus** at the top
     (see 3.2) timed to "catch" the beam. The two halves of the screen are joined
     by one continuous gesture.
- **Timing:** `--dur-signature-eff` (~1000ms) total. Charge `--ease-emphasis`, fire
  `--ease-out-soft`, condense `--ease-spring`.
- **Failure state:** if send fails, the beam **recoils** back to the button and the
  button border pulses `--danger` once. Content is *never* cleared (baseline rule).
- **Reduced motion:** no beam/shockwave. Button shows a single opacity check‑state;
  queue row appears via opacity only.
- **Acceptance:** eye is provably pulled left→right; zero layout shift; total ≤ 650ms;
  feels like *cause and effect*, not two separate animations.

### 3.2 🛬 QUEUE ARRIVAL — "Condense"
- **Trigger:** New item enters queue (own send OR realtime from another device).
- **Choreography:** Row materializes from a **blurred glowing smear** →
  `blur(8px)→0`, `scale(0.96)→1`, `opacity 0→1`, with a one‑shot edge sweep along
  the top border. **Own send = lime sweep. Remote arrival = `--accent-cyan` sweep**
  + a small "from another device" cyan dot that fades after 2s.
- **Timing:** `--dur-expand`, `--ease-spring`. Stagger siblings by 40ms if multiple
  arrive together.
- **Reduced motion:** opacity fade only; keep the color distinction (lime vs cyan).
- **Acceptance:** a realtime arrival is *instantly distinguishable* from a local one
  by color, without reading text.

### 3.3 🔗 PAIRING — "Establish Link"
*The emotional peak: two devices shake hands for the first time.*

- **Trigger:** Successful pair (QR scanned / code accepted).
- **Choreography:** QR module **dissolves into particles** that drift inward and
  **re‑form as the live sync indicator** (the existing `sync-pulse` dot). A single
  ring expands once. Copy shifts from "Pairing QR visible" → "Linked".
- **Timing:** `--dur-signature`, `--ease-out-soft` dissolve + `--ease-spring` reform.
- **Reduced motion:** cross‑fade QR → linked state, no particles.
- **Acceptance:** the moment reads as *celebration + continuity* (the QR literally
  becomes the live link), not a generic success toast.

### 3.4 ⏳ EXPIRY — "Decay" (turn the constraint into the aesthetic)
*Items vanish after one hour. Make the limitation beautiful.*

- **Trigger:** Item enters last ~60s before expiry, then expires.
- **Choreography:**
  - **Approaching (last 60s):** row edge gains a slow **dim‑pulse**; the time badge
    shifts toward amber `--warning`. Subtle, peripheral — not alarming.
  - **Expire:** row **disintegrates** — edges fray into drifting light particles,
    `opacity→0`, slight upward drift, then collapses height with a layout‑safe
    helper. Like the content "evaporated."
- **Timing:** decay `--dur-signature`, `--ease-decay`.
- **Reduced motion:** fade + height collapse, no particles.
- **Acceptance:** expiry feels *intentional and calm*, never like a bug or a j'erk.

### 3.5 ✓ COPY — "Imprint" (highest‑frequency moment → hand‑feel)
- **Trigger:** Copy Markdown / copy code block.
- **Choreography:** icon **morphs** clipboard→check (path morph or crossfade), a
  tight **lime ripple** radiates from the button, label briefly tints `--accent`,
  settles back in `--dur-feedback`. **Zero layout shift** (reserve width — baseline
  rule). Optional: very subtle haptic via `navigator.vibrate(8)` on supporting
  devices.
- **Timing:** `--dur-feedback`, `--ease-emphasis`.
- **Reduced motion:** instant icon swap + label tint, no ripple.
- **Acceptance:** copying 10× in a row stays crisp and satisfying, never tiring or
  janky.

---

## 4. Material & Light System ("looks expensive")

This is what separates "cool" from "premium." All subtle by design.

1. **Edge light:** panels get a 1px top **inset highlight** (`--edge-light`) to read
   as lit glass, not flat cards. Stronger on raised/active surfaces.
2. **Cursor spotlight:** active panel carries a faint `--spotlight` radial that
   follows the pointer (throttled, transform/opacity only). Imperceptible
   individually; unmistakably "alive" in aggregate.
3. **Grain:** a `--grain-opacity` noise layer over large flat fills + aurora to kill
   **color banding** on big screens. Static, GPU‑cheap (single tiled PNG or SVG
   `feTurbulence`, `pointer-events:none`).
4. **Depth tiers:** enforce 3 elevations — `surface-base` < `surface-panel` <
   `surface-raised` — via background + edge‑light, *not* heavy drop shadows
   (shadow is not a primary animated property — baseline rule).
5. **Aurora restraint:** keep the existing aurora, but couple it *very slightly* to
   activity — a send nudges aurora brightness for ~1s, so the ambient field feels
   responsive to use, not just a screensaver.

---

## 5. Motion Choreography Vocabulary

Named primitives so every animation is composed from a known set:

| Primitive | What it does | Tokens |
|---|---|---|
| `charge` | element compresses/dims as if inhaled | `scale .98`, `--ease-emphasis`, `--dur-tap` |
| `fire` | shockwave ring + beam streak along relay axis | `--beam-core`, `--ease-out-soft` |
| `condense` | blur+scale+fade *in* from a smear | `--ease-spring`, `--dur-expand` |
| `decay` | fray into particles + drift out | `--ease-decay`, `--dur-signature` |
| `imprint` | ripple + label tint + icon morph | `--ease-emphasis`, `--dur-feedback` |
| `sweep` | one‑shot edge light traveling a border | lime(local)/cyan(remote) |
| `magnet` | hover pull 2–3px toward cursor | `--ease-out-soft`, `--dur-tap` |
| `stagger` | sequence siblings by 40–80ms | — |

**Rules of restraint:**
- Signature primitives (`fire`, `condense`, `decay`) appear **only** at the 5 moments.
- Everyday surfaces use only `imprint`, `sweep`, `magnet`, `stagger`.
- **90% of the UI stays quiet.** If everything glows, nothing matters.

---

## 6. Typography & Iconography

- Keep the **mono label** signature (lime, `0.14em`, uppercase) — it's brand DNA.
- **[Shipped]** A **tabular/telemetry treatment for numbers** — the `.telemetry`
  utility (`font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1`)
  plus an intrinsic `tabular-nums` on `.queue-time`. Applied to every live numeral:
  the expiry countdown, the markdown byte counter, all `formatBytes` file sizes,
  the created-at clock, and queue counts. Fixed-advance digits → live data reads as
  an instrument readout and never reflows as values change.
- **Display face: SKIP (decision recorded — do not adopt a web display face).**
  Rationale: the product's brand is *fast* (§0/§7) and it ships as a static GitHub
  Pages app — a web font is render-blocking payload + FOUT/CLS, which violates the
  "gated on it not hurting load" constraint. The existing **mono label** (lime,
  `0.14em`, uppercase) already supplies the distinctive memory hook, and the new
  **tabular telemetry numerals** add a second typographic signature at *zero* font
  payload. We stay system-native (`ui-sans-serif` + `ui-monospace`) by design.
- Icons: keep `@tabler/icons-react`. The only custom motion icon is the
  copy→check morph (3.5).

---

## 7. Performance Budget (hard guardrails)

- **Only animate `transform` & `opacity`.** No width/height/top/left/box‑shadow as
  primary animated props (baseline rule, reaffirmed).
- `will-change` only on actively animating elements; remove after.
- Particle effects (3.3, 3.4) capped: ≤ 24 particles, canvas or transforms, and
  **auto‑disabled under reduced motion or on low‑power heuristics**.
- Spotlight & aurora coupling must be **rAF‑throttled**; no per‑mousemove React state.
- Target: **60fps on a mid‑tier laptop**, no dropped frames during THE SEND.
- The relay's brand is *fast*. Any effect that adds perceived latency to send/copy is
  rejected on principle.

---

## 8. Accessibility (non‑negotiable)

- Every Signature Moment ships its **reduced‑motion fallback in the same PR** — not
  later. `@media (prefers-reduced-motion: reduce)` already exists; extend it.
- Maintain **WCAG AA** contrast; lime text stays on dark only, large/heavy weights.
- Color is never the *only* signal — cyan "remote" arrival also carries a text/badge
  cue for color‑blind users.
- Focus states remain visible (existing 2px lime outline) and must not be hidden by
  new glow layers.
- Particle/decay effects are decorative → `aria-hidden`, and must not change reading
  order or announce noise to screen readers.

---

## 9. Phasing / Execution Order

Ship the **core relay axis first** — it defines the product's personality and is the
most‑used path.

- **Phase 1 — The Relay Axis (highest ROI):** 3.1 THE SEND + 3.2 QUEUE ARRIVAL,
  including local‑vs‑remote color split. New tokens (§2). This alone moves the needle
  most.
- **Phase 2 — Hand‑feel everywhere:** 3.5 COPY imprint, `magnet` + `sweep` on
  buttons, `stagger` on first paint & queue load.
- **Phase 3 — Material layer:** edge light, grain, cursor spotlight, depth tiers,
  aurora‑activity coupling (§4).
- **Phase 4 — Emotional peaks:** 3.3 PAIRING dissolve→link, 3.4 EXPIRY decay.
- **Phase 5 — Typography pass & QA:** telemetry numerals, optional display face,
  full reduced‑motion + perf audit.

Each phase is independently shippable and leaves the app in a coherent state.

---

## 10. Acceptance Criteria / Taste Bar

A change passes only if **all** hold:

1. **Coherent:** justifiable as `fire → travel → condense → decay`.
2. **Fast:** adds zero perceived latency to send/copy; 60fps through THE SEND.
3. **Restrained:** quiet 90% of the time; signature primitives only at the 5 moments.
4. **No layout shift:** especially copy buttons and queue rows.
5. **Reduced‑motion parity:** an elegant, non‑broken fallback ships simultaneously.
6. **AA accessible:** contrast, focus, non‑color cues all intact.
7. **Screenshot‑worthy:** at least the 5 moments make you want to do it again.

### Explicit fails (carried from baseline + new)
- Decorative animation with no state meaning.
- A second accent color outside syntax + state.
- Any effect that stutters on a mid laptop.
- Toast spam, marketing hero, heavy onboarding.
- Copy/queue controls that shift layout on state change.

---

## 11. Open Questions

### Resolved (locked in prototype — see §2.5)
- ~~Beam streak: literal vs implied?~~ → **Literal travelling streak.**
- ~~Signature pacing: snappy vs cinematic?~~ → **Cinematic, ×1.6 (~1000ms).**
- ~~Effect intensity?~~ → **~50% (moderate, confident, not gaudy).**

### Resolved (Phase 5)
- ~~Particles: canvas vs pure‑CSS transforms?~~ → **Pure‑CSS transform/opacity spans**
  (`<ParticleBurst>`), capped ≤24 and budget‑gated to 0 under reduced‑motion / low‑power
  by `particleBudget()` — no canvas, no per‑device branching needed.
- ~~Optional display face: worth the font payload, or stay system‑native?~~ →
  **Stay system‑native — SKIP the display face** (see §6). A web font's render‑blocking
  payload / FOUT / CLS conflicts with the *fast* brand (§0/§7); the mono label + new
  tabular telemetry numerals already give the typographic memory hook at zero payload.

### Still open
- Aurora‑activity coupling intensity: how much is "alive" vs "distracting"?
  (Currently ~1s lime pulse on send; tuned by feel, left open for future taste passes.)

> These are intentionally left for the interactive prototype to answer by feel.

---

## 12. Implementation Status Checklist (definition of "100% / fully upgraded")

The upgrade is **complete only when every box below is checked**. Partial delivery
with remaining boxes logged as "gaps" does **not** count as done. Each phase updates
this list as the durable record of progress.

### Phase 1 — Relay Axis
- [x] Token layer added to `:root`: `--dur-tap/feedback/expand/transition/signature`,
      `--dur-signature-eff`, `--ease-emphasis`, `--ease-decay`, `--beam-core/edge`.
      (`--beam-core` corrected from the doc's invalid 7‑digit `#eaffb9a` → `#eaffb9`.)
- [x] 3.1 THE SEND: charge → fire (literal beam streak L→R) → condense, ~1000ms
      cinematic envelope, shockwave ring, fail‑state beam recoil + danger pulse,
      content never cleared. (`SendBeam` overlay + composer charge/shockwave/fail fx;
      `sendMessage` fires `triggerSendFx('fire')` on commit, `'recoil'` on failure;
      clear runs only in the success branch.)
- [x] 3.2 Queue Arrival: condense (blur+scale+fade), **lime sweep for local /
      `--accent-cyan` sweep for remote**, cyan "from another device" dot fading ~2s.
      (Origin tracked via `seenIdsRef` + `arrivals` map; `data-origin` drives sweep
      color + remote cue.)
- [x] Local‑vs‑remote arrival is distinguishable by color alone.
      (Verified in preview: local row = lime sweep, remote row = cyan sweep + dot +
      "from another device" text cue.)

### Phase 2 — Hand‑feel
- [x] 3.5 COPY imprint: icon morph clipboard→check, lime ripple, label tint,
      **zero layout shift**, optional `navigator.vibrate(8)`.
      (Shared `CopyButton` + `useCopyImprint` hook drive every copy surface —
      Markdown detail, code block, pairing. `.fx-imprint` stacks idle/copied/
      failed labels in one grid cell so width is constant — verified identical
      across all three states in preview; `flex-shrink:0` keeps the label from
      collapsing in tight rows. Haptic via `triggerHaptic(8)` on success.)
- [x] `magnet` hover (2–3px pull) on primary buttons.
      (`.fx-magnet` CSS gives a flat 2px lift; the optional `attachMagnet` helper
      adds rAF-throttled cursor-follow on the hero Send button — written straight
      to `--magnet-x/y` inline, never React state. Applied to Send, Copy buttons,
      Create/Join, Choose-files. Excludes `:active`/`:disabled` so press wins.)
- [x] `sweep` edge‑light primitive reusable.
      (`.fx-sweep::after` travels a top border, colour via `--sweep-color`, speed
      via `--sweep-dur`. Queue arrival composes it via JSX — lime local / cyan
      remote — replacing the old one-off `edge-sweep`.)
- [x] `stagger` (40–80ms) on first paint and queue load.
      (`.fx-stagger > *` reads `--stagger-index` (set by the `staggerStyle` helper)
      × `--stagger-step` (60ms), capped at 6. Queue rows verified at 0/60/120ms;
      composer→queue panels first-paint at 0/60ms.)
- [x] Motion primitives (`charge/fire/condense/decay/imprint/sweep/magnet/stagger`)
      exist as **reusable, composable, extensible** utilities — not one‑offs.
      (Central MOTION PRIMITIVES layer in `styles.css` + `src/lib/motion.ts`
      helpers. `charge`/`condense`/`sweep` refactored from Phase-1 one-offs into
      shared `.fx-*` classes the SEND/queue now compose; `decay` defined and ready
      for Phase 4; `fire` documented as the single-use `.send-*` composition.
      Reduced-motion handled centrally in one block.)

### Phase 3 — Material layer
- [x] Edge light (`--edge-light`) on panels; stronger on raised/active.
      (`.panel` carries `box-shadow: inset 0 1px 0 var(--edge-light)` over its soft
      ambient shadow; `.composer-panel`/`.queue-panel` bump to `--edge-light-strong`
      on `:hover`/`:focus-within`; raised surfaces — `.room-menu`, `.modal-panel`,
      `.confirm-dialog`, `.mobile-detail-sheet` — also take the strong inset edge.)
- [x] Cursor spotlight (`--spotlight`), rAF‑throttled, transform/opacity only.
      (`attachSpotlight` in `src/lib/motion.ts` mirrors `attachMagnet`: rAF-throttled
      `pointermove` writes panel-relative `--spot-x/--spot-y` straight to inline style,
      **no React state**, no-op under reduced motion. `.panel-spotlight` is a decorative
      `z-index:-1` layer per panel — the glow tracks via `transform` only and fades via
      `opacity` only; one active panel at a time. Verified: glow pools on the panel
      surface, behind content, never washing out text/focus.)
- [x] Grain layer (`--grain-opacity`) over flat fills + aurora, anti‑banding.
      (`<GrainField>` → fixed `z-index:2`, `pointer-events:none`, `aria-hidden`,
      `opacity: var(--grain-opacity)`; a tiled inline-SVG `feTurbulence` desaturated to
      grayscale — **no colour introduced**. Static/GPU-cheap; above panels + aurora,
      below menus/modals. Verified the noise renders by temporarily boosting opacity.)
- [x] 3 enforced depth tiers (base < panel < raised).
      (`--surface-base` `#070a0c` < `--surface-panel` < `--surface-raised`; elevation is
      carried by background + edge-light strength, not heavy drop shadow — base is bare,
      panels get `--edge-light`, raised overlays get `--edge-light-strong`.)
- [x] Aurora brightness nudges on activity (~1s after a send).
      (`AmbientField` takes `energizedSignal = sendFx.id` when `phase==='fire'`; an effect
      flips `data-energized` on `.ambient-field` for ~1s — written to the DOM, no per-frame
      state. `.ambient-pulse` (lime, `mix-blend:screen`, **opacity-only**) rises in 160ms,
      decays ~760ms — no conflict with the aurora keyframes. Verified end-to-end on a real
      send: the flag held ~1s then settled. Auto-disabled under reduced motion since the
      whole field is `display:none`.)

### Phase 4 — Emotional peaks
- [x] 3.3 PAIRING: QR dissolves into particles → re‑forms as live sync dot.
      (`PairingCard` gains a `linked` state; the `.qr-placeholder` dissolves
      (`pairing-qr-out`) while `ParticleBurst direction="converge"` flies inward
      and re‑forms the existing `.sync-dot[data-status="connected"]` + a one‑shot
      `.pairing-ring`; heading shifts "Pairing QR visible" → "Linked". Triggered
      both manually ("We're linked" button) and automatically when a remote
      arrival proves a second device is live while the card is open
      (`remoteArrivalSignal`, presentation‑only — no pairing data logic changed).
      Reduced motion → crossfade, no particles. Verified in preview.)
- [x] 3.4 EXPIRY: last‑60s edge dim‑pulse + amber time badge → disintegrate
      particles, drift, layout‑safe height collapse.
      (QueueRow sets `data-approaching` when `remainingMs ≤ 60s`: a decorative
      `.queue-edge` opacity dim‑pulse + the `.queue-time` badge shifts to
      `--warning` amber. On expiry, `useExpiryDecay` detects rows that left
      `activeItems` because they expired — not deleted — and renders an
      `aria-hidden`, non‑interactive `ExpiryGhost` in the row's measured place:
      `ParticleBurst direction="scatter"` (rise) + a fading shape
      (transform/opacity), then the single layout‑safe `height`+`margin` collapse
      §3.4 sanctions. No reflow jump; the expired row leaves the a11y tree
      immediately. Reduced motion → fade + instant collapse, no particles.)
- [x] Reusable, capped (≤24), reduced‑motion‑aware **particle utility** shared by
      3.3 and 3.4.
      (`<ParticleBurst>` in `src/components/ParticleBurst.tsx` — `aria-hidden`,
      pure transform/opacity spans, `scatter`/`converge` directions, props
      `count`/`spread`/`rise`/`color`/`durationMs`/`burstKey`. Count clamped by
      the central `particleBudget()` in `src/lib/motion.ts` (hard cap
      `PARTICLE_MAX = 24`), which returns 0 — render nothing — under reduced
      motion or a low‑power device (deviceMemory ≤2 / hardwareConcurrency ≤2 /
      Save‑Data / low‑uncharging Battery). Verified in preview: 20‑particle
      burst capped, and particles gated to 0 independently under both
      reduced‑motion and a faked low‑memory hint.)

### Phase 5 — Typography & QA gate
- [x] Telemetry numerals (tabular) for countdown, file sizes, progress %.
      (New `.telemetry` utility — `font-variant-numeric: tabular-nums` +
      `font-feature-settings: "tnum" 1` — plus intrinsic `tabular-nums` on
      `.queue-time`. Applied to every live numeral: the expiry countdown
      (`formatTimeRemaining`), the markdown byte counter, all `formatBytes` file
      sizes (composer dock, attachment rows, detail image/file rows), the
      created-at clock, queue counts, and the detail/confirm time lines. Progress
      itself is a bar, not numeric %, now driven by `transform: scaleX` (below).
      Fixed-advance digits → live data never reflows as values tick.)
- [x] Optional display face decision **recorded** (ship or skip + reason).
      (**SKIP** — stay system-native; see §6 + §11. A web display face is
      render-blocking payload + FOUT/CLS, conflicting with the *fast* brand
      (§0/§7) and the "gated on not hurting load" constraint. The mono label +
      new tabular telemetry numerals already supply the typographic memory hook
      at zero font payload.)
- [x] Every new animation has a `prefers-reduced-motion` fallback.
      (Central `@media (prefers-reduced-motion: reduce)` block neutralizes *all*
      motion via the `*` / `*::before` / `*::after` override —
      `animation-duration: .001ms`, `animation-iteration-count: 1`,
      `transition-duration: .001ms` — then adds per-effect rules for THE SEND
      (beam/shockwave/flash hidden), QUEUE ARRIVAL (opacity-only, remote cue kept),
      COPY imprint (ripple hidden), magnet (no pull), spotlight (hidden), and
      particles + pairing-ring (hidden → PAIRING crossfades, EXPIRY fades +
      collapses). Audited every keyframe / transition: none escapes the override.)
- [x] All animated properties are `transform`/`opacity` only; no layout‑prop animation.
      (**Animated-property policy, audited across every keyframe + `transition:`** —
      *Motion* is exclusively `transform` + `opacity` (beam = translateX/scaleX,
      shockwave/imprint = scale, particles = translate3d/scale, sweep = translateX,
      condense = scale/translate, etc.). The former `width`-driven `.progress-fill`
      is converted to `transform: scaleX()` (`transform-origin: left`), so the
      **only** layout-prop animation that remains is the §3.4-sanctioned expiry
      `height`/`margin` collapse helper. `box-shadow` is now a purely *static*
      depth/edge cue (§4.4/§7): the three former box-shadow *transitions* —
      `.editor` focus ring, `.attachment-card` hover, and the
      `.composer-panel`/`.queue-panel` edge-light — were made static (values kept,
      transitions dropped); nothing visual was removed. `filter: blur` appears only
      in the §3.2-mandated condense smear (GPU-composited, reflow-free,
      RM-neutralized); the remaining `color`/`border-color`/`background-color`
      transitions and the markdown-link `background-size` underline are paint-only,
      reflow-free, not in §7's ban list, and RM-safe.)
- [x] `will-change` applied only while animating; particles auto‑disable under
      reduced‑motion / low‑power.
      (Audited all 7 `will-change` sites: each is on either a perpetually-animating
      ambient layer — `.ambient-aurora`, which is `display:none` under reduced
      motion — or a transiently-mounted signature element — send beam / core /
      shockwave / fail-flash, `.fx-particle`, pairing — that only exists in the DOM
      during its animation. None sits on a permanently-static element. Particles
      are clamped by `particleBudget()` (`src/lib/motion.ts`, hard cap
      `PARTICLE_MAX = 24`), which returns 0 — renders nothing — under reduced motion
      or a low-power device.)
- [x] AA contrast, visible focus, non‑color cue for remote arrival, decorative
      layers `aria-hidden`.
      (Secondary/functional text bumped `slate-500` → `slate-400` (#94a3b8, ≥4.5:1
      AA on the dark surfaces; lime `--accent` and amber `--warning` already clear
      AA as light tones). Focus stays visible — global `outline: 2px solid #befc3c`
      on `:focus-visible`, with the editor swapping in an equivalent static
      box-shadow ring. Remote arrival carries a non-colour cue — `.arrival-remote`
      renders a "from another device" text badge + `aria-label`. All decorative
      layers are `aria-hidden`: `AmbientField`, `GrainField`, `SendBeam`,
      `.panel-spotlight`, `ParticleBurst`, `.pairing-ring`, `.queue-edge`,
      `.queue-decay-ghost`, `.arrival-dot`, `.sync-dot`.)
- [x] `npm run build`, `npm run lint`, `npm test` all pass; dev server has **no
      console errors**; preview screenshots captured for each signature moment.
      (Build green — `tsc -b` typechecks the `transform: scaleX` progress binding;
      lint clean; **34/34 tests pass**. Dev server (port 5199) verified end-to-end:
      console had **zero errors and zero warnings** across a full send → arrival →
      copy → pairing → expiry walkthrough. Preview screenshots captured for each of
      the 5 signature moments: THE SEND (lime beam mid-flight across the relay
      axis), QUEUE ARRIVAL (local lime edge; remote cyan + "from another device"
      verified via `--sweep-color: #7dd3fc` / cyan dot), PAIRING (QR-visible →
      "Linked" with the connected lime sync-dot), EXPIRY (amber `--warning` badge +
      `expiry-dim-pulse` edge on the approaching row), COPY (clipboard→check icon
      morph + lime label tint, zero layout shift). Telemetry numerals confirmed via
      `preview_inspect`: `.telemetry` / `.queue-time` compute
      `font-variant-numeric: tabular-nums`; functional text computes `slate-400`
      (#94a3b8, AA-clear on the dark surfaces).)
