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
- Introduce a **tabular/mono treatment for numbers** (expiry countdown, file sizes,
  progress %) so live data has a "telemetry" feel and never reflows.
- Consider one distinctive display face for `h2` panel titles to create a memory
  hook — *optional, gated on it not hurting load.*
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

### Still open
- Particles: canvas vs pure‑CSS transforms — decide on the perf budget per device.
- Optional display face: worth the font payload, or stay system‑native?
- Aurora‑activity coupling intensity: how much is "alive" vs "distracting"?

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
- [ ] 3.5 COPY imprint: icon morph clipboard→check, lime ripple, label tint,
      **zero layout shift**, optional `navigator.vibrate(8)`.
- [ ] `magnet` hover (2–3px pull) on primary buttons.
- [ ] `sweep` edge‑light primitive reusable.
- [ ] `stagger` (40–80ms) on first paint and queue load.
- [ ] Motion primitives (`charge/fire/condense/decay/imprint/sweep/magnet/stagger`)
      exist as **reusable, composable, extensible** utilities — not one‑offs.

### Phase 3 — Material layer
- [ ] Edge light (`--edge-light`) on panels; stronger on raised/active.
- [ ] Cursor spotlight (`--spotlight`), rAF‑throttled, transform/opacity only.
- [ ] Grain layer (`--grain-opacity`) over flat fills + aurora, anti‑banding.
- [ ] 3 enforced depth tiers (base < panel < raised).
- [ ] Aurora brightness nudges on activity (~1s after a send).

### Phase 4 — Emotional peaks
- [ ] 3.3 PAIRING: QR dissolves into particles → re‑forms as live sync dot.
- [ ] 3.4 EXPIRY: last‑60s edge dim‑pulse + amber time badge → disintegrate
      particles, drift, layout‑safe height collapse.
- [ ] Reusable, capped (≤24), reduced‑motion‑aware **particle utility** shared by
      3.3 and 3.4.

### Phase 5 — Typography & QA gate
- [ ] Telemetry numerals (tabular) for countdown, file sizes, progress %.
- [ ] Optional display face decision **recorded** (ship or skip + reason).
- [ ] Every new animation has a `prefers-reduced-motion` fallback.
- [ ] All animated properties are `transform`/`opacity` only; no layout‑prop animation.
- [ ] `will-change` applied only while animating; particles auto‑disable under
      reduced‑motion / low‑power.
- [ ] AA contrast, visible focus, non‑color cue for remote arrival, decorative
      layers `aria-hidden`.
- [ ] `npm run build`, `npm run lint`, `npm test` all pass; dev server has **no
      console errors**; preview screenshots captured for each signature moment.
