/**
 * store.ts — the Director store (SoT §3): the single source of runtime truth that
 * every subsystem reads from, which is what makes them feel like "one director".
 *
 * Two channels, by update frequency:
 *  - High-frequency pointer data lives in a plain mutable singleton (`pointer`).
 *    It is mutated in-place by a window listener and *polled* by systems inside
 *    `useFrame`. Routing pointermove through React/zustand would re-render the
 *    tree dozens of times a second; polling a mutable object is the r3f-idiomatic
 *    high-frequency pattern.
 *  - Discrete, low-frequency state (act, ready, sync, energy, tier) lives in a
 *    zustand store so the handful of components that branch on it (Boot, CameraRig)
 *    re-render exactly when it changes.
 */

import { create } from 'zustand';
import type { QualityTier } from './quality';

/** The act state machine that bounds scope (SoT §4). Phase 1 uses boot → deck. */
export type Act =
  | 'boot'
  | 'deck'
  | 'composing'
  | 'sending'
  | 'receiving'
  | 'expiring'
  | 'pairing';

// --------------------------------------------------------------------------------------
// Pointer — mutable singleton with inertia (the signature "field follows you" feel)
// --------------------------------------------------------------------------------------

export interface PointerState {
  /** Smoothed, inertial pointer in normalized device space (-1..1). */
  x: number;
  y: number;
  /** Inertial velocity (smoothed delta), used to push the field. */
  vx: number;
  vy: number;
  /** Raw target the smoothed values chase. */
  tx: number;
  ty: number;
}

export const pointer: PointerState = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 };

/** Feed a raw browser pointer event into the singleton's target. */
export function setPointerTarget(clientX: number, clientY: number): void {
  pointer.tx = (clientX / window.innerWidth) * 2 - 1;
  pointer.ty = -((clientY / window.innerHeight) * 2 - 1);
}

/**
 * Integrate the pointer toward its target with inertia. Called once per frame by
 * the master clock. `dt` is the clamped frame delta.
 */
export function integratePointer(dt: number): void {
  const ease = 1 - Math.pow(0.0001, dt); // frame-rate-independent smoothing (~0.1/frame @60)
  const px = pointer.x;
  const py = pointer.y;
  pointer.x += (pointer.tx - pointer.x) * ease;
  pointer.y += (pointer.ty - pointer.y) * ease;
  // Velocity is the smoothed per-second displacement (decays toward 0 when still).
  pointer.vx += ((pointer.x - px) / Math.max(dt, 1e-4) - pointer.vx) * ease;
  pointer.vy += ((pointer.y - py) / Math.max(dt, 1e-4) - pointer.vy) * ease;
}

// --------------------------------------------------------------------------------------
// Discrete director state (zustand)
// --------------------------------------------------------------------------------------

export interface ExperienceState {
  /** Current act. */
  act: Act;
  /** Assets + shaders ready → boot can resolve into the deck. */
  ready: boolean;
  /** Sync liveness 0..1 — drives the core's "breathing" amplitude (SoT §4 deck). */
  sync: number;
  /** Composer energy 0..1 (reserved for Phase 2 charge). */
  energy: number;
  /** Effective quality tier (mirrors quality.ts for in-scene branching). */
  tier: QualityTier;
  /** Reduced-motion → calmed render loop. */
  reducedMotion: boolean;

  setAct: (act: Act) => void;
  setReady: (ready: boolean) => void;
  setSync: (sync: number) => void;
  setEnergy: (energy: number) => void;
  setTier: (tier: QualityTier) => void;
  setReducedMotion: (reduced: boolean) => void;
}

export const useExperienceStore = create<ExperienceState>((set) => ({
  act: 'boot',
  ready: false,
  sync: 0.6,
  energy: 0,
  tier: 'A',
  reducedMotion: false,

  setAct: (act) => set({ act }),
  setReady: (ready) => set({ ready }),
  setSync: (sync) => set({ sync: Math.max(0, Math.min(1, sync)) }),
  setEnergy: (energy) => set({ energy: Math.max(0, Math.min(1, energy)) }),
  setTier: (tier) => set({ tier }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
}));
