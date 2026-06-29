# AnyText — Living Scene Architecture (Cinematic WebGL Stage)

> **Status:** Active single source of truth for the experience rebuild.
> **Supersedes:** the *experience/motion* portions of
> [`anytext-tier-s-motion-scope.md`](./anytext-tier-s-motion-scope.md). That doc's
> CSS deck is **retained, not deleted** — it becomes the **Tier‑D lite/fallback
> mode** and the **color‑discipline baseline**. Everything visual beyond Tier‑D is
> governed here.
> **Decision locked:** ambition tier = **Cinematic WebGL Stage** (a persistent
> real‑time WebGL world as the living stage; DOM tool surfaces float inside it,
> synced to one clock). Not "Scene‑native full 3D"; not "targeted set‑pieces."

---

## 0. Why we are doing this (the post‑mortem that justifies the rewrite)

The previous pass failed because it was **the wrong medium for the idea**. "Luminous
mass traveling through space" was expressed as a 3px DOM gradient `<span>` translated
across the screen — so it read as a thin line flashing once. Worse, four CSS
animations (charge/shockwave/beam/condense) were chained by `setTimeout` with **no
shared timeline**, so they looked like separate twitches, not one gesture. The root
cause was a self‑imposed ceiling: *"not a rewrite, layer onto CSS."*

This document removes that ceiling. The verdict from the reference (lusion.co): the
win is **not "many animations"** — it is **one continuous real‑time scene governed by
one director, one clock, and one lighting model**, where every subsystem (loader,
camera, pointer, objects, transitions, text) reads from the same state.

---

## 1. The One Sentence (new aesthetic)

> **AnyText is a persistent real‑time light field. Your room is a luminous energy
> core at the center of a scene. Sending is a real volumetric light projectile.
> Arriving is particles condensing out of space. Expiring is matter reclaimed by
> the field. Everything shares one clock, one lighting model, one camera.**

The old "Command Deck + a few animations" framing is retired. The deck UI still
exists — but as **tool surfaces floating inside the living scene**, not as the whole.

---

## 2. Hard constraints (non‑negotiable — this is ambition, not retreat)

A cinematic stage that breaks the tool is a failed tech demo. These are part of the
spec, with equal weight to the spectacle:

1. **It must stay a usable tool.** People paste text, edit Markdown, copy, and move
   files across devices. **You cannot type into a shader.** Text/Markdown/file
   surfaces remain crisp DOM, layered into the scene (drei `<Html>` or a locked
   overlay). The scene is the *stage and connective tissue*, never the input surface.
2. **Preserve the proven relay core.** `src/lib/*` (Supabase RPC, pairing, realtime,
   clipboard), Markdown sanitization, and one‑hour expiry logic are **left intact**.
   We rebuild the **experience layer only**. Rewriting working backend integration
   adds risk for zero visual gain.
3. **Progressive enhancement + graceful fallback.** The tool boots **functional
   first**; the scene hydrates after via lazy‑load. No‑WebGL / reduced‑motion /
   low‑power / Save‑Data / low‑end mobile → a **fully usable lite mode** (Tier‑D).
   AnyText is a *cross‑device* tool — mobile is a first‑class target, not an
   afterthought.
4. **Perceived speed is sacred.** The scene must never gate the actual relay. Sending
   commits immediately; the cinematic shot is celebratory and non‑blocking. 60fps on
   a mid laptop; smooth on mobile; render loop pauses when the tab is hidden.
5. **Accessibility.** The canvas is `aria-hidden` and fully bypassable. The tool is
   100% operable by keyboard and screen reader with the canvas absent. Every "act"
   has a non‑canvas equivalent. `prefers-reduced-motion` → Tier‑D or a calmed tier.

---

## 3. The Director Engine (the spine)

A **single, never‑unmounted WebGL world** plus **one shared state store**. Every
subsystem reads from that store — that is what makes them feel like "one director."

```
<Experience>  ── one persistent R3F <Canvas>; one useFrame = the master clock
   │
   ├─ experienceStore (zustand) ── the single source of runtime truth
   │     pointer{x,y,vx,vy}(inertia) · act · energy · time · qualityTier · reducedMotion
   │     act: boot → deck → composing → sending → receiving(local|remote) → expiring
   │
   ├─ CameraRig   spring camera; per‑act framing; transitions = camera moves, not page swaps
   ├─ PostFX      EffectComposer: Bloom (lime becomes real volumetric light) +
   │              ChromaticAberration (on impact) + subtle DOF + film grain — global
   ├─ PointerField   GPGPU/shader particle field; cursor pushes it with inertia (signature feel)
   ├─ RelayCore      central volumetric node = the room/connection; breathes on sync, ripples on impact
   ├─ SendBeam       volumetric projectile on send; motion trail; impact at the core/queue
   ├─ ArrivalCondense  particle condensation at the queue anchor (local lime / remote cyan from depth)
   └─ Decay          dematerialize → particles reclaimed by the field on expiry
```

**The "one director" mechanism is literally the shared store.** Pointer movement
simultaneously bends the field, shifts the core's specular highlight, and parallaxes
the camera — because they all read the same value each tick. CSS keyframes
structurally cannot do this.

### 3.1 The Anchor Bridge (the make‑or‑break glue)
For the beam to actually fire from the *real* Send button to the *real* queue, DOM and
WebGL must share coordinates. DOM tool components register their screen‑space rect via
`useSceneAnchor(id)`; the scene projects those into 3D space (`anchors.ts`). The beam,
condense burst, and decay all originate/terminate at real DOM anchors. **This is what
fuses the floating DOM tool with the stage** — without it, effects feel detached
(the original sin again).

---

## 4. Acts (the state machine that bounds scope)

| Act | Camera / Scene | Tool layer |
|---|---|---|
| **boot** | shaders compile while RelayCore "powers up"; resolves by pulling back **into** the deck (no spinner→swap) | tool mounts functional underneath |
| **deck** (idle) | wide framing; core breathes with sync; field idles | composer + queue floating, parallaxed |
| **composing** | core leans toward composer; energy rises with input | textarea focused (DOM) |
| **sending** | charged packet → volumetric beam (anchor‑bridged) → core ripple → queue condense; camera micro‑kick | content commits immediately |
| **receiving‑local** | lime condense at queue top | new row materializes |
| **receiving‑remote** | packet arrives from **z‑depth** trailing **cyan** → condense; "from afar" is now spatial | cyan row + remote marker |
| **expiring** | row dematerializes; particles reclaimed into the field | layout‑safe height collapse |
| **pairing** | QR dissolves into the field → re‑forms as the live sync core; ring | pairing card ↔ "Linked" |

`fail(sending)` → beam **recoils** to the button, core flashes danger once, **content
never cleared.**

---

## 5. THE SEND, done right (the redemption of the thin line)

Not a DOM gradient. A continuous ~1s shot, GPU particles + shaders:

1. **Charge** — composed text collapses into a bright energy packet at the composer
   anchor (volume + bloom, not a flat span).
2. **Fire** — the packet launches as a **volumetric beam projectile**: hot core,
   falloff, **motion‑blur trail**, chromatic aberration on launch, a camera kick.
3. **Travel** — it crosses the **PointerField**, displacing particles in its wake
   (it interacts with the world — mass and follow‑through).
4. **Impact** — it strikes the **RelayCore**, which ripples outward.
5. **Condense** — a new message **condenses out of a particle burst** at the queue
   anchor, timed to "catch" the beam. One gesture, one clock.

This is the bar the old beam missed: **weight, trail, interaction, impact,
continuity** — none achievable in layout‑bound DOM.

---

## 6. Performance & Quality Tiers

Auto‑detected (GPU probe + `prefers-reduced-motion` + `deviceMemory`/
`hardwareConcurrency` + Save‑Data + battery), with a **manual toggle** and persisted
preference. Adaptive DPR via drei `PerformanceMonitor`; render loop **pauses on
`document.hidden`**; delta clamped.

| Tier | Target | Field | PostFX | DPR |
|---|---|---|---|---|
| **A** | desktop / good GPU | full GPGPU | Bloom + CA + DOF + grain | up to 2 |
| **B** | mid / integrated GPU | reduced particle count | Bloom + grain | 1–1.5 |
| **C** | mobile / low | instanced points, no GPGPU | Bloom optional | 1 |
| **D** | no‑WebGL / reduced‑motion / Save‑Data | **none — CSS lite deck** | none | — |

Tier‑D is the **existing cleaned‑up CSS deck** (the old Tier‑S doc), fully functional,
zero canvas.

---

## 7. Tech stack & module layout

Stack (on the current React 19 + Vite + TS base):
`three` · `@react-three/fiber` · `@react-three/drei` · `@react-three/postprocessing`
· `gsap` (timelines) · `lenis` (inertial queue scroll) · `zustand` (director store) ·
custom GLSL. **`src/lib/*`, Markdown, clipboard, pairing untouched.**

```
src/experience/
  Experience.tsx        # persistent <Canvas> + provider; mounted once at app root, lazy‑loaded
  store.ts              # zustand director store (the single runtime truth)
  director.ts           # subscribes to app events (send/arrival/pair/expire) → drives acts
  quality.ts            # device tiering, DPR, visibility pause, manual toggle
  anchors.ts            # DOM rect → scene‑space projection (the Anchor Bridge)
  useSceneAnchor.ts     # hook DOM components use to register their anchor
  rig/CameraRig.tsx  rig/PostFX.tsx
  systems/PointerField.tsx  systems/RelayCore.tsx  systems/SendBeam.tsx
  systems/ArrivalCondense.tsx  systems/Decay.tsx
  shaders/*.glsl
```

The **entire `src/experience/*` tree is dynamically imported** after the functional
tool's first paint, so Three.js never bloats the critical path. Tier‑D never loads it.

---

## 8. Phasing — heavy, staged, each phase shippable

Front‑load the risk: prove the plumbing before building spectacle.

- **Phase 0 — Foundation & de‑risk spike.** Install stack. Mount a persistent
  (empty) `<Canvas>` behind the current DOM, lazy‑loaded. Prove: bundle code‑split,
  quality tiering, Tier‑D fallback switch, visibility pause, and an **Anchor‑Bridge
  POC** (a debug dot tracking the real Send button). Nothing flashy — proves the
  architecture holds and the tool still works untouched.
- **Phase 1 — The stage comes alive.** PointerField + RelayCore + PostFX bloom +
  CameraRig idle framing + boot/loader resolving into the deck. "The world is alive."
- **Phase 2 — THE SEND.** §5 end‑to‑end, anchor‑bridged real button → real queue,
  fail‑recoil. The redemption.
- **Phase 3 — Receiving / remote / expiry.** Remote packet from z‑depth (cyan
  spatial semantics); local vs remote; expiry dematerialize/reclaim.
- **Phase 4 — Camera, transitions, text.** Act transitions as camera moves; pairing
  dissolve→link as a scene event; GSAP text reveals on the shared clock; Lenis queue
  inertia.
- **Phase 5 — Tool‑layer integration.** DOM composer/queue/Markdown locked into the
  scene (depth, parallax, `<Html>`/overlay); copy & micro‑interactions re‑tuned to
  the new world.
- **Phase 6 — Perf / fallback / mobile / a11y close‑out.** All four tiers tuned;
  60fps desktop, smooth mobile, functional Tier‑D; bundle audit; full reduced‑motion
  + keyboard + screen‑reader pass; `build`/`lint`/`test` green; per‑moment captures.

Each phase appends to **§10 Implementation Status** (the definition of done).

---

## 9. Risks (honest)

- **Shader/GPGPU iteration time** is the biggest unknown — Phase 0/1 will calibrate.
- **Mobile perf** is the hardest constraint and is core to the product (cross‑device).
  Tier C/D exist precisely for this; we do not punt it to the end conceptually.
- **Bundle vs "feels fast."** Mitigated by lazy‑load discipline (Phase 0 gate).
- **DOM‑in‑scene correctness** (the Anchor Bridge) — de‑risked first in Phase 0.
- **Scope creep** — bounded by the §4 act state machine; no act, no effect.

---

## 10. Implementation Status Checklist (definition of "done")

> Filled in per phase. Partial delivery with boxes logged as "gaps" is **not** done.

### Phase 0 — Foundation
- [ ] Stack installed; `src/experience/Experience.tsx` mounts a persistent, lazy‑loaded `<Canvas>`; tool unaffected.
- [ ] `store.ts` (zustand) + `quality.ts` tiering (A/B/C/D) with manual toggle + persistence.
- [ ] Tier‑D path renders zero canvas and is fully functional.
- [ ] Render loop pauses on `document.hidden`; adaptive DPR wired.
- [ ] Anchor‑Bridge POC: a scene marker tracks the real Send button's DOM rect.
- [ ] Three.js code‑split out of the critical chunk (verify in build output).

### Phase 1 — Stage alive
- [ ] PointerField with inertial pointer; RelayCore breathing on sync; Bloom PostFX; CameraRig idle.
- [ ] Boot/loader sequence resolves into the deck (no spinner→swap).

### Phase 2 — THE SEND
- [ ] Charge → volumetric beam (trail + CA + camera kick) → field displacement → core ripple → condense, one ~1s shot, anchor‑bridged.
- [ ] Fail‑state recoil + danger flash; content never cleared.

### Phase 3 — Receiving / remote / expiry
- [ ] Remote packet from z‑depth with cyan; local vs remote distinguishable spatially + by color.
- [ ] Expiry dematerialize/reclaim with layout‑safe collapse.

### Phase 4 — Camera / transitions / text
- [ ] Act transitions as camera moves; pairing dissolve→link scene event.
- [ ] GSAP text reveals on the shared clock; Lenis queue inertia.

### Phase 5 — Tool‑layer integration
- [ ] Composer/queue/Markdown visually locked into the scene (depth/parallax).
- [ ] Copy imprint + micro‑interactions re‑tuned to the new world; zero layout shift.

### Phase 6 — Perf / fallback / mobile / a11y
- [ ] Tiers A–D all tuned; 60fps desktop, smooth mobile, functional Tier‑D.
- [ ] Full `prefers-reduced-motion`, keyboard, and screen‑reader pass; canvas `aria-hidden`.
- [ ] `npm run build` / `npm run lint` / `npm test` green; no console errors; per‑moment captures.
