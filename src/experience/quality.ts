/**
 * quality.ts — device tiering + manual toggle for the WebGL experience layer.
 *
 * IMPORTANT: this module is imported on the critical path (App.tsx) to decide
 * whether to even load the experience chunk. It MUST stay light — no `three`,
 * no `@react-three/*` imports. Pure DOM / navigator feature detection only.
 *
 * Tiers (SoT §6):
 *   A — desktop / good GPU      → full field, full GLB, Bloom+DOF+grain, DPR up to 2
 *   B — mid / integrated GPU    → reduced field, full GLB, Bloom+grain, DPR 1–1.5
 *   C — mobile / low            → instanced points, Bloom optional, DPR 1
 *   D — no-WebGL / reduced-motion / Save-Data → CSS lite deck, zero canvas, zero asset fetch
 */

import { useEffect, useState } from 'react';

export type QualityTier = 'A' | 'B' | 'C' | 'D';

/** User-facing override, persisted. `auto` follows device detection. */
export type ExperiencePreference = 'auto' | 'on' | 'off';

const PREF_KEY = 'anytext.experience.pref';

// --------------------------------------------------------------------------------------
// Low-level capability probes (each cheap + defensive — never throw on a weird browser)
// --------------------------------------------------------------------------------------

let cachedWebgl: boolean | null = null;

/** Does this browser actually give us a WebGL context? (cached — context creation is not free) */
export function hasWebGL(): boolean {
  if (cachedWebgl !== null) return cachedWebgl;
  if (typeof document === 'undefined') return (cachedWebgl = false);
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl');
    cachedWebgl = Boolean(gl);
    // Release the probe context immediately so it never counts against the
    // browser's live-context budget.
    const lose = (gl as WebGLRenderingContext | null)?.getExtension('WEBGL_lose_context');
    lose?.loseContext();
  } catch {
    cachedWebgl = false;
  }
  return cachedWebgl;
}

function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function saveDataOn(): boolean {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return Boolean(conn?.saveData);
}

function isCoarsePointer(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
}

// --------------------------------------------------------------------------------------
// Tier detection
// --------------------------------------------------------------------------------------

/** Pure device heuristic, ignoring the user's manual preference. */
export function detectAutoTier(): QualityTier {
  // Hard Tier-D gates: cannot or should-not render the canvas at all.
  if (!hasWebGL()) return 'D';
  if (prefersReducedMotion()) return 'D';
  if (saveDataOn()) return 'D';

  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  const coarse = isCoarsePointer();

  // Low-power / mobile → Tier C (lean field, optional bloom).
  if (coarse || mem <= 2 || cores <= 4) return 'C';
  // Mid integrated GPU → Tier B.
  if (mem <= 4 || cores <= 8) return 'B';
  // Roomy desktop → Tier A.
  return 'A';
}

/** Resolve the effective tier from the persisted preference + device detection. */
export function resolveTier(pref: ExperiencePreference): QualityTier {
  if (pref === 'off') return 'D';
  if (pref === 'on') {
    // Honour the toggle, but never promise a canvas a device cannot draw.
    return hasWebGL() ? (detectAutoTier() === 'D' ? 'C' : detectAutoTier()) : 'D';
  }
  return detectAutoTier();
}

/** The experience canvas mounts for every tier except D. */
export function shouldMountExperience(tier: QualityTier): boolean {
  return tier !== 'D';
}

// --------------------------------------------------------------------------------------
// Persistence
// --------------------------------------------------------------------------------------

export function loadPreference(): ExperiencePreference {
  try {
    const v = localStorage.getItem(PREF_KEY);
    if (v === 'on' || v === 'off' || v === 'auto') return v;
  } catch {
    /* private mode / disabled storage → fall through to auto */
  }
  return 'auto';
}

export function savePreference(pref: ExperiencePreference): void {
  try {
    localStorage.setItem(PREF_KEY, pref);
  } catch {
    /* non-fatal */
  }
}

// --------------------------------------------------------------------------------------
// React surface
// --------------------------------------------------------------------------------------

export interface ExperienceController {
  /** Effective tier after preference + device detection. */
  tier: QualityTier;
  /** Whether the WebGL canvas should mount (tier !== D). */
  active: boolean;
  /** Does the device support WebGL at all (drives whether the toggle is meaningful). */
  supported: boolean;
  /** Current persisted preference. */
  preference: ExperiencePreference;
  /** Update + persist the preference (re-resolves the tier). */
  setPreference: (pref: ExperiencePreference) => void;
}

/**
 * Critical-path-safe hook: decides synchronously (first render) whether the
 * experience layer should load, and re-resolves when the user toggles the
 * preference or flips the reduced-motion system setting.
 */
export function useExperienceController(): ExperienceController {
  const [preference, setPreferenceState] = useState<ExperiencePreference>(loadPreference);
  const [tier, setTierState] = useState<QualityTier>(() => resolveTier(preference));

  const setPreference = (pref: ExperiencePreference) => {
    savePreference(pref);
    setPreferenceState(pref);
    setTierState(resolveTier(pref));
  };

  // React to the OS reduced-motion setting changing mid-session.
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setTierState(resolveTier(preference));
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [preference]);

  return {
    tier,
    active: shouldMountExperience(tier),
    supported: hasWebGL(),
    preference,
    setPreference,
  };
}
