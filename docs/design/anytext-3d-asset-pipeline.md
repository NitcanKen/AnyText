# AnyText — 3D Asset Pipeline & Provisioning Spec

> **Purpose:** what must be installed/configured so Claude can **generate** the hero
> "relay core" 3D asset (plus supporting models/HDRI) and build the real‑time scene
> to ~100% match `docs/assets/anytext-ux-annotation-integrated-v2.png`.
> **Owner of the model:** Claude authors it as code (`bpy` Python) — the user does
> **not** hand‑model in Blender. The user provisions tools / approves installs / supplies any API keys.

---

## 0. Machine audit (this device)

| Item | Result | Implication |
|---|---|---|
| macOS 26.5, **Apple M4**, 8 GPU cores, **16 GB**, Metal 4 | ✅ | Blender runs well (Metal/Cycles). |
| Homebrew 6.0.3 | ✅ | `brew install --cask blender` works. |
| Node 24.16 / npm 11.13 | ✅ | R3F stack ready. |
| Blender | ❌ not installed | **Install required (primary tool).** |
| Python | system 3.9.6 only | Fine — Blender ships its own Python for `bpy`. |
| gltf-transform / draco / meshopt | ❌ | npm install. |
| HDRI / .glb assets | ❌ none | Download (Poly Haven) or generate. |
| Local AI‑3D (Hunyuan3D/TRELLIS) | ⚠️ not viable | CUDA‑centric; 16 GB Apple GPU too tight → use cloud if AI‑gen wanted. |

---

## 1. The pipeline (3 stages)

```
A. MODEL GENERATION            B. OPTIMIZE/EXPORT             C. WEB INTEGRATION
   Blender (bpy script)   →      gltf-transform / Draco   →     React-three-fiber scene
   + studio HDRI                 (compress, dedupe)             (the v2 demo, asset-backed)
   [optional: cloud AI-3D]       → core.glb (web-ready)         lazy-loaded, Tier-D fallback
```

### Stage A — Model generation (primary: procedural Blender)
Claude writes a `bpy` Python script that builds the core (machined hub, stacked
beveled discs, radial turbine vanes via array+rotate, bolt rings, royal‑blue tube
rings via curve+bevel, greeble panels), assigns PBR materials (dark metal / royal‑blue
plastic / emissive blue), loads a studio HDRI, then **renders a preview PNG headless**
to compare against the reference and iterate parameters. Run headless:
```bash
/Applications/Blender.app/Contents/MacOS/Blender -b -P build_core.py
```
This iterate‑render‑compare loop is how we converge to the reference.

### Stage B — Optimize / export to web
```bash
npx @gltf-transform/cli optimize core.glb core.web.glb --compress draco
```
(dedupe, weld, Draco/meshopt compression, texture resize → small web‑ready `.glb`.)

### Stage C — Web integration
Build the real scene around the asset with the R3F stack; load via `GLTFLoader`/drei
`useGLTF`; studio HDRI for reflections; `@react-three/postprocessing` for Bloom + DOF;
GSAP for the relay choreography. Lazy‑loaded; Tier‑D (no‑WebGL) fallback preserved.

---

## 2. Install matrix

### MUST install
| Tool | Command | Who | Notes |
|---|---|---|---|
| **Blender 4.x** | `brew install --cask blender` | user‑approve / Claude | ~system install; the core tool. |
| **R3F web stack** | `npm i three @react-three/fiber @react-three/drei @react-three/postprocessing gsap lenis zustand` | Claude | in‑repo; do at formalization. |
| **gltf-transform** | `npm i -D @gltf-transform/cli` | Claude | GLB optimize/compress. |
| **Studio HDRI** | download `.hdr` from polyhaven.com (e.g. `brown_photostudio`, `studio_small`) | needs network | reflections that make metal read as a render. |

### RECOMMENDED (power‑tool — big quality/speed win)
| Tool | What it adds | Setup |
|---|---|---|
| **Blender MCP** (`ahujasid/blender-mcp`) | Lets Claude drive Blender **live** + bundles **Poly Haven** asset/HDRI download, **Sketchfab**, and **Hyper3D Rodin** generative 3D. | install the MCP server (`uvx blender-mcp`, needs `uv`) + the Blender addon, then add to Claude's MCP config. Verify latest steps. |

### OPTIONAL (AI‑3D booster — only if we want geometry generated from the reference)
| Service | Use | Needs |
|---|---|---|
| **Hyper3D Rodin** (via Blender MCP), **Meshy**, **Tripo**, **Luma Genie** | image→3D from the reference render as a base mesh, then bpy cleanup | **cloud API key + credits** (user supplies). Cloud, so M4 RAM is irrelevant. |

---

## 3. Decisions for the user

1. **Install Blender now?** (`brew install --cask blender`) — yes/approve so Claude can start the procedural core.
2. **Add Blender MCP?** (recommended — gives live Blender control + free Poly Haven HDRIs/assets + Rodin AI‑gen). Needs `uv` + addon + MCP config.
3. **AI‑3D booster wanted?** If yes, which service + provide API key/credits. If no, Claude goes pure‑procedural bpy (slower to organic detail, fully controllable).
4. **Network access** for asset/HDRI downloads at build time — allowed?

---

## 4. What Claude delivers once provisioned
- `assets/relay-core.glb` (+ variants) — generated, optimized, web‑ready.
- The asset‑backed R3F scene matching the reference (core + connectors + ribbon +
  orbit + bokeh + grade) with the full DOM UI suite + browser frame.
- All wired into the living‑scene architecture (Phase 0–1), lazy‑loaded, Tier‑D safe.

## 5. Honest ceiling
With Blender installed + an HDRI, procedural `bpy` reaches a **genuinely detailed,
controllable** hero core (close to the reference). Adding the **AI‑3D booster** closes
the remaining organic‑complexity gap fastest. Either way, the engineering (scene, UI,
grade, integration) is fully in hand — the only external dependency is **tooling +
optional API credits**, which this spec enumerates.
