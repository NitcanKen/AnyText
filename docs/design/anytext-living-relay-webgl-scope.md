# AnyText "Living Relay" — WebGL Layer Scope

> **Status:** Proposal / Single Source of Truth for the GPU/WebGL ambition.
> **Supersedes for the visual layer:** This document sits *above*
> [`anytext-tier-s-motion-scope.md`](./anytext-tier-s-motion-scope.md). That CSS
> motion work is **not discarded** — it is re-designated as the **Tier‑0 fallback**
> (the experience shown when WebGL is unavailable, reduced‑motion is on, or the GPU
> is too weak). This doc defines the GPU layer that renders *above* it on capable
> devices.
> **Ambition bar:** [lusion.co](https://lusion.co) — real‑time GPU simulation, not
> CSS polish. We adapt Lusion's *techniques* to a utility, we don't copy a landing
> page.

---

## 0. Why this document exists (the honest reset)

The Tier‑S CSS pass was a high‑quality *polish* layer. It was the wrong **medium**
for the stated goal. Lusion‑class work does not live in CSS keyframes; it lives in
**WebGL shaders, GPGPU particle simulation, fluid, light, and post‑processing**,
running a real render loop that reacts to the user every frame.

Three philosophy shifts define this layer:

1. **Pre‑baked → simulated.** A CSS keyframe plays the same way every time and
   ignores you. A simulation is computed each frame and **responds to pointer
   position, velocity, and momentum**. Dead vs alive.
2. **Decorate the UI → the content *is* the material.** The send "beam" was a
   gradient symbol of teleport. Here, **the message's own glyphs rasterize into
   particles, fly across as matter, and re‑condense** into the new row. Content
   becomes physics.
3. **Discrete moments → one living field.** The whole canvas is alive and
   cursor‑aware at all times; the signature moments are *peaks within* that field,
   not isolated animations on a static page.

### The utility constraint (what keeps this from becoming a screensaver)
AnyText is a 5‑second relay tool. We do **not** Lusion‑ify every pixel. We pick the
product's spine — **the act of relaying content across devices** — and make *that*
a true simulation, while everything else stays fast, quiet, and instantly usable.
One unforgettable GPU moment beats a screen that glitters everywhere. The GPU layer
is a **celebration layer**; it must never sit on the critical path of actually
sending or copying data.

---

## 1. Goals & Non‑Goals

### Goals
- A **continuous, cursor‑reactive WebGL field** as the app's living substrate
  (replaces the CSS aurora on capable devices).
- **THE SEND as real GPGPU particles**: glyphs → particle stream → flow across →
  re‑condense as the new queue row. The showpiece.
- **Remote arrival felt as a disturbance** in the field (cyan shockwave from edge).
- **Material reveals** (shader refraction/dispersion) and a **post‑processing pass**
  (bloom + chromatic aberration + grain) that unify everything into one cinematic
  surface.
- **Cursor physics**: inertia/spring, magnetic fields, particles displaced around
  interactive elements.
- A **capability‑tiered, gracefully degrading** system that falls back to the
  shipped CSS Tier‑0 experience with zero broken UI.

### Non‑Goals
- No new product features, accounts, or data‑model changes.
- No degradation of the relay's speed promise: the send/copy **data path is
  decoupled** from the FX and never blocked by it.
- Not Lusion's *content* (3D scenes, scroll storytelling) — only its *techniques*,
  applied to a tool.
- No second accent beyond lime/cyan (now expressed as shader uniforms).

---

## 2. Constraint change (must be ratified)

The rule **"animate only `transform` / `opacity`"** (CLAUDE.md + Tier‑S doc) is
hereby **scoped to DOM UI only**. The sanctioned **WebGL canvas layer is exempt**
and is instead governed by its own **GPU frame budget** (§5) and **degradation
contract** (§6). On ratification, update CLAUDE.md's Conventions accordingly.

---

## 3. Technical architecture

### 3.1 Renderer decision — **OGL** (WebGL2), lazy‑loaded
- **Decision:** Build on **OGL** (~50KB, thin WebGL2 wrapper), with **hand‑written
  GLSL** for the field, the GPGPU particles, and the post chain.
- **Rationale:** Smallest footprint for a tool whose JS bundle is already ~700KB;
  full control over the simulation; no heavy scene‑graph we don't need.
- **Escape hatch (recorded, not chosen):** Three.js + `pmndrs/postprocessing` +
  `GPUComputationRenderer` would cut dev time on bloom/GPGPU at a larger bundle
  cost. Revisit only if OGL hand‑rolling becomes the schedule risk.
- **Loading:** the entire WebGL module is a **dynamic `import()`**, code‑split,
  fetched **only after** the core app is interactive **and** the device passes the
  capability gate (§6). The relay works fully before a single shader loads.

### 3.2 The RelayStage controller (imperative bridge)
A single `<canvas>` sits behind the DOM (`z-index: 0`; DOM UI floats at `z-index: 1`,
mirroring today's ambient field). A lazy‑loaded `RelayStage` module owns the render
loop and exposes a small imperative API the React app calls from effects:

```
stage.setPointer(x, y, velocity)     // every pointermove (rAF‑throttled)
stage.energize(intensity)            // a send fired — pulse the field
stage.emit(fromRect, toRect, source) // THE SEND: glyphs → particles → target
stage.arrive(edge, 'remote')         // cyan shockwave from a screen edge
stage.materialize(rect)              // shader reveal for a new card
stage.setQuality(tier)              // 0|1|2 — runtime auto-tuning
stage.pause() / stage.resume()       // tab hidden / on battery saver
```

### 3.3 DOM ↔ WebGL coordinate bridge
DOM elements report `getBoundingClientRect()` to the stage so particles fly from the
**actual composer textarea** to the **actual new queue row** position. A shared
resize/scroll observer keeps the mapping correct. This is what makes the effect feel
*attached to the UI*, not floating over it.

### 3.4 "Glyphs → particles" technique
On send: rasterize the composed content (or a representative crop) to an **offscreen
canvas** → sample non‑empty pixels → seed particle positions in a GPGPU **ping‑pong
FBO** → advect along a **curl‑noise flow field** biased toward `toRect` → ease into
final lattice → hand off to the DOM row's shader `materialize`. Particle count is
**tier‑scaled** (§5).

### 3.5 Render passes (Tier 2)
1. **Field pass** — fullscreen flow‑field/fluid fragment shader (half‑res buffer,
   upsampled), lime/cyan uniforms, pointer‑advected.
2. **Particle pass** — GPGPU positions → additive points.
3. **Post pass** — bloom (threshold+blur, downsampled), subtle chromatic aberration,
   film grain, vignette — composited to screen.

---

## 4. Feature set (the full living layer)

| # | Surface | Behavior |
|---|---|---|
| F1 | **Living field** | Fullscreen GPU flow‑field, always animating, advected by pointer velocity. Replaces CSS aurora. |
| F2 | **THE SEND** | Glyphs rasterize → GPGPU particles → curl‑noise flow Composer→Queue → re‑condense into the new row. Fail = particle recoil, content never cleared. |
| F3 | **Remote arrival** | Cyan shockwave propagates through the field from the screen edge; the field "ripples" — you feel a remote landing. Local = lime energize from the composer. |
| F4 | **Material reveal** | New card surfaces via shader refraction/dispersion, not fade. |
| F5 | **Cursor physics** | Pointer inertia/spring; magnetic pull on primary buttons; particles displaced (soft‑body) around hovered controls. |
| F6 | **Post / grade** | Bloom + chromatic aberration + grain + vignette unify the frame. |
| F7 | **Seamless transitions** | First‑run→workspace and tab switches dissolve through the stage instead of hard cuts. |
| F8 | **Sound (optional)** | Tiny synthesized Web Audio cues on send/arrive/copy. Muteable; off by default; late phase. |

Color discipline unchanged: **lime = action/live/yours**, **cyan = remote arrival**,
now as shader uniforms.

---

## 5. GPU frame budget & quality tiers

- **Target:** 60fps (≤16.6ms/frame) at the active tier; 120fps headroom on strong
  GPUs. **Auto‑downscale** if frame time exceeds budget for N consecutive frames.
- **Particle counts (indicative, runtime‑scaled):** Tier 2 ≈ 130k–250k · Tier 1 ≈
  30k–60k · Tier 0 = none.
- **Buffers:** field & bloom at half/quarter res; post cheap; cap `devicePixelRatio`
  at ~2.
- **Throttle:** pause the loop when `document.hidden`; drop to Tier 1 on
  `navigator.getBattery()` saver / `prefers-reduced-data`; never run hot in the
  background.

---

## 6. Degradation contract (zero broken UI, ever)

Capability gate runs before loading the WebGL module:

- **Tier 0 — CSS fallback (already shipped):** no WebGL2, OR `prefers-reduced-motion`,
  OR `save-data`, OR capability probe fails, OR WebGL context lost. Renders today's
  Tier‑S CSS experience. **No GPU code loads.**
- **Tier 1 — modest/mobile GPU:** living field + post‑lite; **no GPGPU send particles**
  (send uses the CSS condense fallback); reduced particle counts.
- **Tier 2 — capable desktop GPU:** full living layer.

Detection inputs: WebGL2 support, a **first‑frame micro‑benchmark** (measure real
frame time, demote if over budget), `hardwareConcurrency`, `deviceMemory`,
`devicePixelRatio`, `prefers-reduced-motion`, `connection.saveData`, battery saver.
**Runtime demotion** is allowed mid‑session if frames degrade. A WebGL **context‑loss
handler** drops cleanly to Tier 0.

---

## 7. Accessibility & trust

- `prefers-reduced-motion` ⇒ Tier 0, no exceptions.
- The canvas is decorative ⇒ `aria-hidden`; it never traps focus or alters reading
  order; DOM remains the single source of interaction and semantics.
- AA contrast preserved for all text over the field (guarantee a darkening scrim
  under text regions; the field must never reduce legibility).
- Remote‑arrival cue is **not color‑only** — keep the existing text/badge signal.
- A visible, persistent **"reduce effects / Tier 0" toggle** in the room menu, so any
  user can opt down instantly. Respect and persist the choice.

---

## 8. Phasing (each phase independently shippable; all = "full living layer")

- **Phase A — Foundation & Field:** lazy OGL canvas, capability/tier system, DOM↔WebGL
  rect bridge, pointer plumbing, the fullscreen reactive flow‑field (F1). Degrades to
  CSS aurora. *This is also the POC for the bar.*
- **Phase B — THE SEND particle teleport (showpiece):** glyph rasterize → GPGPU →
  flow → re‑condense (F2), incl. fail recoil. Tier‑1 keeps CSS condense.
- **Phase C — Reactive field & arrivals:** remote cyan shockwave (F3), pointer
  inertia + magnetic fields + soft‑body displacement (F5).
- **Phase D — Material & post:** shader card reveal (F4), post chain bloom/CA/grain/
  vignette (F6).
- **Phase E — Transitions, sound, QA gate:** seamless transitions (F7), optional audio
  (F8), full cross‑device GPU/battery/perf matrix, a11y + degradation audit, bundle
  budget check.

---

## 9. Acceptance / taste bar

Passes only if **all** hold:
1. **Alive, not looped:** the field provably reacts to pointer velocity/position —
   freeze the mouse and it settles; whip it and the field reacts.
2. **Content as matter:** THE SEND visibly turns the message into particles that
   travel and re‑form — readable as cause→effect across the relay axis.
3. **60fps at the active tier**, with clean auto‑demotion and `document.hidden` pause.
4. **Relay speed unchanged:** send/copy data path latency identical to today; FX is
   non‑blocking and decoupled.
5. **Degrades to zero‑broken Tier 0** on no‑WebGL / reduced‑motion / weak GPU / context
   loss; user can opt down anytime.
6. **AA legibility** of all text over the field.
7. **Screenshot‑and‑replay‑worthy:** the send and a remote arrival make you want to do
   it again — and it reads as *attached to the UI*, not a bolted‑on screensaver.

### Explicit fails
- A pretty but non‑reactive background (a "video texture" that ignores the cursor).
- Any jank on a mid‑tier laptop, or battery drain in the background.
- Effects that delay or gate the actual send/copy.
- Text made hard to read by the field.
- Bundle bloat loaded on the critical path (must be code‑split + gated).

---

## 10. Risks & mitigations
- **Bundle size / TTI** → WebGL module is dynamic‑imported, code‑split, gated; core
  relay ships and runs before it loads.
- **Mobile GPU / battery** → tiers, DPR cap, half‑res buffers, hidden‑tab pause,
  battery‑saver demotion.
- **Dev complexity (raw GLSL GPGPU/fluid/post)** → phased; Phase A delivers the bar;
  Three.js escape hatch recorded if schedule slips.
- **"Fast tool" identity** → data path decoupled; effects celebratory only.
- **Cross‑device variance** → first‑frame benchmark + runtime demotion + context‑loss
  recovery.

---

## 11. Open questions (to resolve during Phase A POC)
- Field model: **flow‑field/curl‑noise** (cheaper, directional) vs **true fluid
  (Navier‑Stokes)** (richer, costlier)? Decide on Phase A perf data.
- Glyph rasterization fidelity: per‑character vs whole‑block crop — quality vs
  particle budget.
- Sound: ship F8 at all, or leave as a documented future hook?

---

## 12. Implementation Status Checklist ("full living layer" = 100%)

The upgrade is complete only when every box is checked. Partial delivery with boxes
logged as "gaps" does **not** count as done.

### Phase A — Foundation & Field
- [ ] Lazy `import()` WebGL module, code‑split; core relay interactive before it loads.
- [ ] Capability gate + Tier 0/1/2 detection (incl. first‑frame benchmark, context‑loss handler).
- [ ] `RelayStage` controller + imperative API wired to React effects.
- [ ] DOM↔WebGL rect bridge (resize/scroll observers).
- [ ] F1 fullscreen reactive flow‑field; pointer velocity advection; lime/cyan uniforms.
- [ ] Degrades to CSS aurora (Tier 0); reduced‑motion path verified.

### Phase B — THE SEND
- [ ] Glyph rasterize → GPGPU ping‑pong particles → curl‑noise flow Composer→Queue → re‑condense into the new row.
- [ ] Fail state: particle recoil + danger pulse; content never cleared.
- [ ] Tier 1 keeps CSS condense fallback; tier‑scaled particle counts.

### Phase C — Reactive field & arrivals
- [ ] F3 remote arrival = cyan shockwave from edge; local = lime energize.
- [ ] F5 pointer inertia/spring, button magnetic fields, soft‑body particle displacement.

### Phase D — Material & post
- [ ] F4 shader refraction/dispersion card reveal.
- [ ] F6 post chain: bloom + chromatic aberration + grain + vignette.

### Phase E — Transitions, sound, QA gate
- [ ] F7 seamless first‑run→workspace and tab transitions through the stage.
- [ ] F8 optional muteable Web Audio cues (or documented future hook + reason).
- [ ] "Reduce effects / Tier 0" toggle in room menu, persisted.
- [ ] 60fps verified at each tier on a real device matrix; `document.hidden` pause; battery‑saver demotion.
- [ ] AA legibility scrim over text; canvas `aria-hidden`; focus/semantics intact.
- [ ] Bundle budget check (WebGL code absent from critical path); `npm run build` / `lint` / `test` green; no console errors.
- [ ] CLAUDE.md Conventions updated for the transform/opacity scope change (§2).
