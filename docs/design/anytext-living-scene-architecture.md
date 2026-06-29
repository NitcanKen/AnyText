# AnyText — Living Scene Architecture (Cinematic WebGL Stage)

> **Status:** Active single source of truth for the experience rebuild.
> **Supersedes:** the *experience/motion* portions of
> [`anytext-tier-s-motion-scope.md`](./anytext-tier-s-motion-scope.md). That doc's
> CSS deck is **retained, not deleted** — it becomes the **Tier-D lite/fallback
> mode** and the **color-discipline baseline**. Everything visual beyond Tier-D is
> governed here.
> **Decision locked:** ambition tier = **Cinematic WebGL Stage** (a persistent
> real-time WebGL world as the living stage; DOM tool surfaces float inside it,
> synced to one clock). Not "Scene-native full 3D"; not "targeted set-pieces."
> **Fidelity target:** ~100% visual match to
> [`../assets/anytext-ux-annotation-integrated-v2.png`](../assets/anytext-ux-annotation-integrated-v2.png),
> achieved with a **generated hero 3D asset** (§7.5–§7.6). The asset toolchain is
> **provisioned and verified live** (Blender 5.1.2 + `blender-mcp` on :9876 +
> PolyHaven CC0 + gltf-transform) at **$0** — no paid services.

---

## 0. Why we are doing this (the post-mortem that justifies the rewrite)

The previous pass failed because it was **the wrong medium for the idea**. "Luminous
mass traveling through space" was expressed as a 3px DOM gradient `<span>` translated
across the screen — so it read as a thin line flashing once. Worse, four CSS
animations (charge/shockwave/beam/condense) were chained by `setTimeout` with **no
shared timeline**, so they looked like separate twitches, not one gesture. The root
cause was a self-imposed ceiling: *"not a rewrite, layer onto CSS."*

This document removes that ceiling. The verdict from the reference (lusion.co): the
win is **not "many animations"** — it is **one continuous real-time scene governed by
one director, one clock, and one lighting model**, where every subsystem (loader,
camera, pointer, objects, transitions, text) reads from the same state.

A second, equally important lesson came from the early procedural demo (since
**removed** — commit `76391d9`): a **generic particle/wireframe look is not the target**.
The reference is **sculptural, material-driven, studio-lit, high-contrast** — which is
why the hero core must be a **generated 3D asset**, not primitives (§7.5).

---

## 1. The One Sentence (new aesthetic)

> **AnyText is a persistent real-time light field. Your room is a luminous energy
> core at the center of a scene. Sending is a real volumetric light projectile.
> Arriving is particles condensing out of space. Expiring is matter reclaimed by
> the field. Everything shares one clock, one lighting model, one camera.**

The old "Command Deck + a few animations" framing is retired. The deck UI still
exists — but as **tool surfaces floating inside the living scene**, not as the whole.

---

## 1.5 Reference fidelity target (what "done" looks like)

The North Star is a ~100% match to
[`../assets/anytext-ux-annotation-integrated-v2.png`](../assets/anytext-ux-annotation-integrated-v2.png).
Concretely, the scene must contain — and the build is judged against — these elements:

- **A browser-framed dark stage** (the app chrome around the scene).
- **A machined "relay core"** at center: a turbine/reactor-like assembly — glossy dark
  metal, stacked machined discs, bolts, **royal-blue plastic tube rings**, a glowing
  **blue lens/energy center**. This is the **generated hero 3D asset** (§7.6).
- **Royal-blue plastic pipe/connector objects** floating at depth (the render's signature).
- **A document-chip ribbon** (PDF/IMG/TXT/code tiles) streaming through the core.
- **A "1h relay orbit"** ring with device nodes + timestamps (MacBook-Pro 09:41 Sent …
  09:44 Arrived, the arrived one lime).
- **Floating glossy black spheres** with hard speculars at varying depth (bokeh).
- **The full DOM tool suite as glass capsules**: Upload (file chips), Compose (+ lime
  Send), Preview (markdown + code-block Copy), image thumbnail, Receive, Download,
  Settings.
- **Grade:** high-contrast black + electric royal-blue + lime; controlled bloom; heavy DOF.

Color discipline still holds: lime = action/yours, cyan = remote arrival. The blue in
the render is the **relay/material** blue (the core, the connectors); **cyan remains
reserved for the remote-arrival signal**, so it stays distinguishable.

---

## 2. Hard constraints (non-negotiable — this is ambition, not retreat)

A cinematic stage that breaks the tool is a failed tech demo. These are part of the
spec, with equal weight to the spectacle:

1. **It must stay a usable tool.** People paste text, edit Markdown, copy, and move
   files across devices. **You cannot type into a shader.** Text/Markdown/file
   surfaces remain crisp DOM, layered into the scene (drei `<Html>` or a locked
   overlay). The scene is the *stage and connective tissue*, never the input surface.
2. **Preserve the proven relay core.** `src/lib/*` (Supabase RPC, pairing, realtime,
   clipboard), Markdown sanitization, and one-hour expiry logic are **left intact**.
   We rebuild the **experience layer only**. Rewriting working backend integration
   adds risk for zero visual gain.
3. **Progressive enhancement + graceful fallback.** The tool boots **functional
   first**; the scene hydrates after via lazy-load. No-WebGL / reduced-motion /
   low-power / Save-Data / low-end mobile → a **fully usable lite mode** (Tier-D).
   AnyText is a *cross-device* tool — mobile is a first-class target, not an
   afterthought.
4. **Perceived speed is sacred.** The scene must never gate the actual relay. Sending
   commits immediately; the cinematic shot is celebratory and non-blocking. 60fps on
   a mid laptop; smooth on mobile; render loop pauses when the tab is hidden.
5. **Accessibility.** The canvas is `aria-hidden` and fully bypassable. The tool is
   100% operable by keyboard and screen reader with the canvas absent. Every "act"
   has a non-canvas equivalent. `prefers-reduced-motion` → Tier-D or a calmed tier.

---

## 3. The Director Engine (the spine)

A **single, never-unmounted WebGL world** plus **one shared state store**. Every
subsystem reads from that store — that is what makes them feel like "one director."

```
<Experience>  ── one persistent R3F <Canvas>; one useFrame = the master clock
   │
   ├─ experienceStore (zustand) ── the single source of runtime truth
   │     pointer{x,y,vx,vy}(inertia) · act · energy · time · qualityTier · reducedMotion
   │     act: boot → deck → composing → sending → receiving(local|remote) → expiring
   │
   ├─ CameraRig   spring camera; per-act framing; transitions = camera moves, not page swaps
   ├─ PostFX      EffectComposer: Bloom (lime/blue become real volumetric light) +
   │              ChromaticAberration (on impact) + DOF bokeh + film grain — global
   ├─ PointerField   shader/instanced field; cursor pushes it with inertia (signature feel)
   ├─ RelayCore      the generated hero .glb (§7.6); breathes on sync, ripples on impact
   ├─ SendBeam       volumetric projectile on send; motion trail; impact at the core/queue
   ├─ ArrivalCondense  particle condensation at the queue anchor (local lime / remote cyan from depth)
   └─ Decay          dematerialize → particles reclaimed by the field on expiry
```

**The "one director" mechanism is literally the shared store.** Pointer movement
simultaneously bends the field, shifts the core's specular highlight, and parallaxes
the camera — because they all read the same value each tick. CSS keyframes
structurally cannot do this.

### 3.1 The Anchor Bridge (the make-or-break glue)
For the beam to actually fire from the *real* Send button to the *real* queue, DOM and
WebGL must share coordinates. DOM tool components register their screen-space rect via
`useSceneAnchor(id)`; the scene projects those into 3D space (`anchors.ts`). The beam,
condense burst, and decay all originate/terminate at real DOM anchors. **This is what
fuses the floating DOM tool with the stage** — without it, effects feel detached
(the original sin again).

---

## 4. Acts (the state machine that bounds scope)

| Act | Camera / Scene | Tool layer |
|---|---|---|
| **boot** | shaders compile + hero asset loads while RelayCore "powers up"; resolves by pulling back **into** the deck (no spinner→swap) | tool mounts functional underneath |
| **deck** (idle) | wide framing; core breathes with sync; field idles | composer + queue floating, parallaxed |
| **composing** | core leans toward composer; energy rises with input | textarea focused (DOM) |
| **sending** | charged packet → volumetric beam (anchor-bridged) → core ripple → queue condense; camera micro-kick | content commits immediately |
| **receiving-local** | lime condense at queue top | new row materializes |
| **receiving-remote** | packet arrives from **z-depth** trailing **cyan** → condense; "from afar" is now spatial | cyan row + remote marker |
| **expiring** | row dematerializes; particles reclaimed into the field | layout-safe height collapse |
| **pairing** | QR dissolves into the field → re-forms as the live sync core; ring | pairing card ↔ "Linked" |

`fail(sending)` → beam **recoils** to the button, core flashes danger once, **content
never cleared.**

---

## 5. THE SEND, done right (the redemption of the thin line)

Not a DOM gradient. A continuous ~1s shot, GPU particles + shaders:

1. **Charge** — composed text collapses into a bright energy packet at the composer
   anchor (volume + bloom, not a flat span).
2. **Fire** — the packet launches as a **volumetric beam projectile**: hot core,
   falloff, **motion-blur trail**, chromatic aberration on launch, a camera kick.
3. **Travel** — it crosses the **PointerField**, displacing particles in its wake
   (it interacts with the world — mass and follow-through).
4. **Impact** — it strikes the **RelayCore**, which ripples outward (sub-rings react).
5. **Condense** — a new message **condenses out of a particle burst** at the queue
   anchor, timed to "catch" the beam. One gesture, one clock.

This is the bar the old beam missed: **weight, trail, interaction, impact,
continuity** — none achievable in layout-bound DOM.

---

## 6. Performance & Quality Tiers

Auto-detected (GPU probe + `prefers-reduced-motion` + `deviceMemory`/
`hardwareConcurrency` + Save-Data + battery), with a **manual toggle** and persisted
preference. Adaptive DPR via drei `PerformanceMonitor`; render loop **pauses on
`document.hidden`**; delta clamped.

| Tier | Target | Field | Hero asset | PostFX | DPR |
|---|---|---|---|---|---|
| **A** | desktop / good GPU | full field | full GLB | Bloom + CA + DOF + grain | up to 2 |
| **B** | mid / integrated GPU | reduced count | full GLB | Bloom + grain | 1–1.5 |
| **C** | mobile / low | instanced points | low-LOD GLB or impostor | Bloom optional | 1 |
| **D** | no-WebGL / reduced-motion / Save-Data | **none — CSS lite deck** | **not fetched** | none | — |

Tier-D is the **existing cleaned-up CSS deck** (the old Tier-S doc), fully functional,
zero canvas, zero asset fetch.

---

## 7. Tech stack & module layout

Stack (on the current React 19 + Vite + TS base):
`three` · `@react-three/fiber` · `@react-three/drei` (incl. `useGLTF`) ·
`@react-three/postprocessing` · `gsap` (timelines) · `lenis` (inertial queue scroll) ·
`zustand` (director store) · custom GLSL. **`src/lib/*`, Markdown, clipboard, pairing
untouched.**

```
src/experience/
  Experience.tsx        # persistent <Canvas> + provider; mounted once at app root, lazy-loaded
  store.ts              # zustand director store (the single runtime truth)
  director.ts           # subscribes to app events (send/arrival/pair/expire) → drives acts
  quality.ts            # device tiering, DPR, visibility pause, manual toggle
  anchors.ts            # DOM rect → scene-space projection (the Anchor Bridge)
  useSceneAnchor.ts     # hook DOM components use to register their anchor
  rig/CameraRig.tsx  rig/PostFX.tsx
  systems/PointerField.tsx  systems/RelayCore.tsx (loads the .glb)  systems/SendBeam.tsx
  systems/ArrivalCondense.tsx  systems/Decay.tsx  systems/Connectors.tsx
  shaders/*.glsl

scripts/blender/
  build_core.py         # bpy authoring script — SOURCE OF TRUTH for the hero asset
  render_preview.py     # headless preview render for reference comparison

public/assets/
  relay-core.glb        # web-optimized hero asset (Draco) — generated, never hand-edited
  connectors.glb        # blue pipe/fitting objects
  hdri/*.hdr            # CC0 PolyHaven studio environment
```

The **entire `src/experience/*` tree is dynamically imported** after the functional
tool's first paint, so Three.js + the GLB never bloat the critical path. Tier-D never
loads it.

---

## 7.5 3D Asset Pipeline & Toolchain (provisioned + verified live)

Reaching the reference's hero core requires a **generated 3D asset**, not procedural
primitives. The toolchain below is installed and **verified working end-to-end** on
this machine (Apple M4 / Blender 5.1.2), at **$0**:

| Tool | Role | Status |
|---|---|---|
| **Blender 5.1.2** | author/iterate the core via `bpy`; render previews; export GLB | ✅ headless `bpy` verified |
| **blender-mcp** (`ahujasid`, `uvx blender-mcp`) | live Claude↔Blender control on **:9876** | ✅ `get_scene_info` returns the live scene |
| **PolyHaven** (CC0, via MCP) | free studio **HDRI** for reflections + textures | ✅ enabled (Hyper3D / Sketchfab / Hunyuan OFF) |
| **gltf-transform 4.4 + Draco** | optimize/compress GLB for web | ✅ 92 KB → 6.7 KB proven |
| **r3f `useGLTF` / drei** | load the asset into the scene | (build phase) |

**Two workflows, by purpose:**
- **Headless `bpy` (primary, deterministic):** Claude authors `scripts/blender/build_core.py`;
  `/Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/blender/build_core.py`
  builds + exports + renders a preview PNG. The **iterate → render → compare-to-reference**
  loop converges the asset. Version-matched to 5.1.2; needs no MCP; reproducible.
- **blender-mcp (interactive):** for live sculpting/inspection and pulling PolyHaven
  HDRIs/textures into the scene. Requires Blender open + addon "Connect to Claude"
  (socket :9876). Tools: `execute_blender_code`, `get_scene_info`,
  `get_viewport_screenshot`, `download_polyhaven_asset`, `search_polyhaven_assets`, …
  Note: MCP tools load at Claude session start; live use needs Blender running.

**Asset budget:** hero core ≤ ~150 KB Draco GLB; ≤ ~40k tris; ≤ 2 atlased materials;
lazy-loaded with the experience layer (never on the critical path; Tier-D never fetches it).
**Licensing:** PolyHaven assets are **CC0**. No paid AI-3D (Hyper3D / Hunyuan / Sketchfab OFF).
**Provisioning spec:** [`anytext-3d-asset-pipeline.md`](./anytext-3d-asset-pipeline.md).

---

## 7.6 Hero relay-core asset spec

The `.glb` Claude generates must read as the reference's center:
- **Form:** concentric machined housing (stacked beveled discs), a central **blue
  energy lens**, radial **turbine vanes**, **bolt rings**, **royal-blue plastic tube
  rings** wrapping the assembly. Hard-surface, mechanical, precise.
- **Separable named parts** so the scene can animate sub-rings independently and emit
  on impact: `hub`, `lens`, `ring.*`, `vanes`, `bolts`, `tube.blue.*`.
- **Materials (PBR):** dark metal (low roughness, clearcoat), royal-blue plastic
  (glossy opaque), emissive blue (the lens → blooms). Baked/atlased to ≤ 2 materials.
- **Origin** at the core center; scaled to unit radius ≈ 1.0 for predictable framing.
- **Export:** GLB, +Y up, applied transforms, smooth shading; then Draco via gltf-transform.
- **Companion assets:** floating **blue connectors** (elbow/T fittings) as a small GLB
  or instanced from the same source; optional greeble for depth.

---

## 7.7 Grading playbook (hard-won — do not relearn these)

From the procedural demo, the look lives in the **grade**, not the effects. Locked lessons:
- **Bloom is a scalpel, not a floodlight.** Over-bloom turns every env specular into a
  white blob (the "particle soup" failure). Keep strength low (~0.4–0.6) and
  **threshold high (~0.7+)** so only emissives + the hottest speculars bloom.
- **Environment reflections make metal read as a render** — but a bright HDRI on
  `metalness=1` blows out. Tune `envMapIntensity` (~0.7–1.3); don't max it.
- **Black ≠ unlit.** Too-dark materials vanish on black. Lift base colors slightly and
  rely on a strong key + **blue rim** for hard speculars (high contrast).
- **DOF bokeh on depth-staggered glossy spheres** = the premium feel. Keep aperture small.
- **Fewer, sculptural objects** beat many glowing ones. The reference is sparse + sculpted.
- Target the **black + royal-blue + lime** triad; blue is material/relay, lime is action,
  cyan stays the remote-arrival signal.

---

## 8. Phasing — heavy, staged, each phase shippable

Front-load the risk: prove the plumbing before building spectacle.

**Asset Track (runs alongside Phase 0–1):** generate the hero relay-core `.glb` + blue
connectors via `bpy`, iterating headless renders against the reference, then
Draco-optimize and fetch a CC0 HDRI. Phase 1's RelayCore loads this asset (not
primitives). Gated by the reference-comparison check, not a fixed time.

- **Phase 0 — Foundation & de-risk spike.** Install the web stack. Mount a persistent
  (empty) `<Canvas>` behind the current DOM, lazy-loaded. Prove: bundle code-split,
  quality tiering, Tier-D fallback switch, visibility pause, and an **Anchor-Bridge
  POC** (a debug dot tracking the real Send button). Nothing flashy — proves the
  architecture holds and the tool still works untouched.
- **Phase 1 — The stage comes alive.** PointerField + RelayCore **(loads the generated
  relay-core.glb)** + PolyHaven HDRI reflections + PostFX bloom + CameraRig idle framing
  + boot/loader resolving into the deck. "The world is alive."
- **Phase 2 — THE SEND.** §5 end-to-end, anchor-bridged real button → real queue,
  fail-recoil. The redemption.
- **Phase 3 — Receiving / remote / expiry.** Remote packet from z-depth (cyan
  spatial semantics); local vs remote; expiry dematerialize/reclaim.
- **Phase 4 — Camera, transitions, text.** Act transitions as camera moves; pairing
  dissolve→link as a scene event; GSAP text reveals on the shared clock; Lenis queue
  inertia.
- **Phase 5 — Tool-layer integration.** DOM composer/queue/Markdown + the full panel
  suite (Upload/Preview/Receive/Download/Settings) + browser frame locked into the
  scene (depth, parallax, `<Html>`/overlay); copy & micro-interactions re-tuned.
- **Phase 6 — Perf / fallback / mobile / a11y close-out.** All four tiers tuned;
  60fps desktop, smooth mobile, functional Tier-D; bundle audit; full reduced-motion
  + keyboard + screen-reader pass; `build`/`lint`/`test` green; per-moment captures.

Each phase appends to **§10 Implementation Status** (the definition of done).

---

## 9. Risks (honest)

- **Asset fidelity vs budget.** The hero core must match the reference *and* stay ≤ ~150 KB.
  Mitigated by the headless iterate-render-compare loop + Draco + LOD for Tier C.
- **Shader/GPGPU iteration time** — Phase 0/1 calibrate.
- **Mobile perf** is the hardest constraint and core to the product (cross-device).
  Tier C/D exist precisely for this; not punted to the end.
- **Bundle vs "feels fast."** Mitigated by lazy-load discipline (Phase 0 gate) — Three.js
  and the GLB are off the critical path.
- **DOM-in-scene correctness** (the Anchor Bridge) — de-risked first in Phase 0.
- **Scope creep** — bounded by the §4 act state machine; no act, no effect.

---

## 10. Implementation Status Checklist (definition of "done")

> Filled in per phase. Partial delivery with boxes logged as "gaps" is **not** done.

### Asset Track (hero 3D asset)
- [x] `scripts/blender/build_core.py` authors the relay-core (machined housing, blue
      lens, vanes, bolts, blue tube rings) with named separable parts. — deterministic
      bmesh lathe; 12 named parts: `ring.mid/base/outer/step/inner`, `hub`, `lens`,
      `vanes`, `bolts`, `tube.blue.0/1/2`. 3 factor-only PBR mats, 0 textures.
- [x] Headless preview render iterated to a **pass** comparison vs
      `anytext-ux-annotation-integrated-v2.png`. — Cycles preview, 6 iterations →
      `docs/assets/relay-core-preview.png` (layered barrel-reactor, recessed blue
      glow, royal-blue tube wrap, dark-gunmetal/royal-blue high contrast).
- [x] Blue connector/fitting asset(s) generated. — `public/assets/connectors.glb`
      (`connector.elbow`, `connector.tee`; 644 tris, 4.6 KB).
- [x] PolyHaven CC0 studio HDRI fetched into `public/assets/hdri/`. —
      `brown_photostudio_02_1k.hdr` (CC0, via blender-mcp).
- [x] Draco-optimized `public/assets/relay-core.glb` within budget (≤ ~150 KB / ≤ 40k tris).
      — **42.6 KB / ~12.5k tris** (gltf-transform, node-preserving optimize; inspect OK).
- [x] Lazy-loaded; Tier-D never fetches it. — asset is a standalone static file in
      `public/assets/`, not imported by any critical-path module (Tier-D never fetches
      it); the r3f `useGLTF` lazy-load wiring lands in Phase 1.

> Reproduce: `scripts/blender/build.sh` (Blender headless `build_core.py` → gltf-transform
> Draco). The `.glb` are build artifacts — never hand-edit; regenerate from `build_core.py`.
> Note: the build is **geometry-deterministic but not byte-reproducible** — re-running
> yields identical structure (same parts/tri-count/size) but different bytes (Blender
> export + Draco are not bit-exact), so a rebuild dirties git. The committed `.glb` is
> canonical; only regenerate when you intentionally change the model.

### Phase 0 — Foundation
> Built alongside Phase 1 in this pass: the stack was present in `node_modules` from
> a prior spike but **undeclared in `package.json`** and **no `src/experience/*` source
> existed**. Both were completed here as the required substrate for Phase 1.
- [x] Stack installed; `src/experience/Experience.tsx` mounts a persistent, lazy-loaded
      `<Canvas>`; tool unaffected. — full stack declared in `package.json`: runtime `three`
      0.182, `@react-three/fiber` 9.6, `drei` 10.7, `@react-three/postprocessing` 3.0,
      `postprocessing` 6.39, `zustand` 5, **`gsap` 3.15, `lenis` 1.3** (Phase 4 libs, declared
      now, imported later → 0 bundle impact: critical chunk byte-identical); dev `@types/three`
      0.185, **`@gltf-transform/cli` 4.4** (asset Draco pipeline). The throwaway
      `living-scene*.html` demos were **removed from the repo** (commit `76391d9`) — never
      deployed, and gone as a mis-reference. Canvas is a fixed `.experience-stage`
      (z-0) behind the DOM; `App.tsx` renders it only when the tier resolves A/B/C. Existing
      tool untouched (one added attribute + one gated root-bg class); `src/lib/*` + App.test.tsx
      behaviour unchanged (34/34).
- [x] `store.ts` (zustand) + `quality.ts` tiering (A/B/C/D) with manual toggle + persistence.
      — `quality.ts` probes WebGL/reduced-motion/Save-Data/deviceMemory/cores/coarse-pointer;
      `SceneToggle` cycles Auto→On→Off persisted to `localStorage` (`anytext.experience.pref`).
- [x] Tier-D path renders zero canvas and is fully functional. — verified live: `Scene · Off`
      → `canvasPresent:false`, tool fully usable, page at 60fps. Tests run in Tier-D (jsdom
      has no WebGL) and stay green.
- [x] Render loop pauses on `document.hidden`; adaptive DPR wired. — `frameloop` flips to
      `never` on `visibilitychange`; `PerformanceMonitor` floats DPR within the tier cap
      (A ≤1.75, B ≤1.5, C =1), starting conservative and climbing only with headroom.
- [x] Anchor-Bridge POC: a scene marker tracks the real Send button's DOM rect. — `anchors.ts`
      (registry + `[data-scene-anchor]` scan) + `useSceneAnchor`; `AnchorBridge` unprojects the
      live Send-button rect each frame (Send button tagged `data-scene-anchor="send"`). Marker
      shown with `?debugAnchor=1`; substrate for the Phase 2 beam.
- [x] Three.js code-split out of the critical chunk (verify in build output). — `three`/r3f/
      drei/postprocessing land in `Experience-*.js` (~1.09 MB, lazy `import()`); the critical
      `index-*.js` stays ~719 KB with no `three`. Tier-D never imports the chunk or fetches the GLB/HDRI.

### Phase 1 — Stage alive
- [x] PointerField with inertial pointer; RelayCore breathing on sync; Bloom PostFX; CameraRig idle.
      — `PointerField` (tier-scaled motes parallax + flow with inertial pointer velocity);
      `RelayCore` lens breathes with `sync` (live Supabase realtime → 0.95); `PostFX` Bloom
      (intensity ~0.7, **threshold 0.72** scalpel) + DOF + AGX + grain; `CameraRig` idle drift
      + pointer parallax. 60fps on Apple M4 (Metal); no console errors.
- [x] **RelayCore loads the generated `relay-core.glb` (asset-backed, not primitives) + PolyHaven
      HDRI reflections.** — drei `useGLTF` loads `relay-core.glb`; named sub-parts (`vanes`,
      `bolts`, `tube.blue.*`) animate independently; Blender PBR mats kept with tuned
      `envMapIntensity`; `<Environment>` provides the `brown_photostudio_02_1k.hdr` reflections
      (not background). `flat` renderer → HalfFloat HDR → AGX, matching the Blender preview.
- [x] Boot/loader sequence resolves into the deck (no spinner→swap). — `Boot` veil over the
      scene (under the tool, functional from frame 0) lifts — never swaps — when `ReadyGate`
      flips `ready` (assets + first frame in); the lens powers up 0→peak and the camera pulls
      back into the deck framing. Failure-fallback timeout lifts the veil if `ready` never fires.

> **Verification (this pass):** `npm run build` / `npm run lint` / `npm test` (34) all green;
> no console errors; preview screenshot of the central core matches the reference
> (glowing blue lens, concentric machined discs, turbine vanes, royal-blue tube wrap, blue
> connectors, depth-staggered glossy spheres, black + royal-blue + lime grade, scalpel bloom);
> Tier-D (`Scene · Off`) renders zero canvas; 60fps on M4. Grade discipline holds: lime/cyan +
> material blue only (cyan stays reserved for remote arrival, unused in the idle deck).

### Phase 2 — THE SEND
- [ ] Charge → volumetric beam (trail + CA + camera kick) → field displacement → core ripple → condense, one ~1s shot, anchor-bridged.
- [ ] Fail-state recoil + danger flash; content never cleared.

### Phase 3 — Receiving / remote / expiry
- [ ] Remote packet from z-depth with cyan; local vs remote distinguishable spatially + by color.
- [ ] Expiry dematerialize/reclaim with layout-safe collapse.

### Phase 4 — Camera / transitions / text
- [ ] Act transitions as camera moves; pairing dissolve→link scene event.
- [ ] GSAP text reveals on the shared clock; Lenis queue inertia.

### Phase 5 — Tool-layer integration
- [ ] Composer/queue/Markdown + full panel suite + browser frame visually locked into the scene (depth/parallax).
- [ ] Copy imprint + micro-interactions re-tuned to the new world; zero layout shift.

### Phase 6 — Perf / fallback / mobile / a11y
- [ ] Tiers A–D all tuned; 60fps desktop, smooth mobile, functional Tier-D.
- [ ] Full `prefers-reduced-motion`, keyboard, and screen-reader pass; canvas `aria-hidden`.
- [ ] `npm run build` / `npm run lint` / `npm test` green; no console errors; per-moment captures.

---

## 11. Decision Log

- **Fidelity path:** **asset-backed** (generated hero `.glb`), not procedural-primitive —
  to reach ~100% of the reference render. (User decision.)
- **3D toolchain:** Blender 5.1.2 with **headless `bpy` as the primary, deterministic
  workflow**. **MCP = community `ahujasid/blender-mcp`** over the official Blender-lab
  MCP — better Claude Code integration, free PolyHaven, and it **empirically loads on
  Blender 5.1.2** (the official one was experimental / unfetchable). Verified live on :9876.
- **No paid services:** Hyper3D Rodin / Hunyuan3D / Sketchfab **OFF**; PolyHaven CC0 only.
  Total tooling cost **$0** (user constraint: free only).
- **Asset, not backend:** experience layer + asset only; `src/lib/*` relay core untouched.
- **Demos** were throwaway proofs of the grade/approach (vanilla three.js, primitive
  look); **removed entirely** (commit `76391d9`) so they can't be mistaken for a reference.
  The **sole visual reference is the annotated PNG** (§1.5); the real scene is
  `src/experience/*`; proven grade values live in §7.7 + the experience code.
- **Provisioning verified** (this session): Blender headless build→GLB→Draco (92 KB→6.7 KB),
  MCP live `get_scene_info`, PolyHaven enabled. See [`anytext-3d-asset-pipeline.md`](./anytext-3d-asset-pipeline.md).
