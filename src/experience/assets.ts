/**
 * assets.ts — base-path-aware URLs for the lazy-loaded experience assets.
 *
 * Vite serves `public/` at `import.meta.env.BASE_URL` (here `/AnyText/` on GitHub
 * Pages, `/` in dev). Referencing the GLB/HDRI as a bare `/assets/...` would 404
 * on the deployed sub-path — always go through BASE_URL.
 *
 * These files live ONLY here in the experience chunk; Tier-D never imports this
 * module, so it never fetches them (SoT §6 / §7).
 */

const BASE = import.meta.env.BASE_URL;

export const ASSET = {
  core: `${BASE}assets/relay-core.glb`,
  connectors: `${BASE}assets/connectors.glb`,
  hdri: `${BASE}assets/hdri/brown_photostudio_02_1k.hdr`,
} as const;
